require('dotenv').config();
const mongoose = require('mongoose');
const PG = require('../models/PGListing');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const total = await PG.countDocuments({});
  const published = await PG.countDocuments({ published: true });
  const withCity = await PG.countDocuments({ published: true, city: { $exists: true, $ne: '' } });
  const withLocality = await PG.countDocuments({ published: true, locality: { $exists: true, $ne: '' } });

  // Do NOT print MONGO_URI or credentials
  console.log('[debugLocations] counts=', { total, published, withCity, withLocality });

  const sample = await PG.findOne({}).select('published city locality address').lean();
  console.log('[debugLocations] sample=', sample);

  const top = await PG.aggregate([
    { $match: { published: true } },
    {
      $addFields: {
        localityTrimmed: { $trim: { input: { $ifNull: ['$locality', ''] } } },
        cityTrimmed: { $trim: { input: { $ifNull: ['$city', ''] } } },
      },
    },
    {
      $addFields: {
        chosenLocationName: {
          $cond: [{ $ne: ['$localityTrimmed', ''] }, '$localityTrimmed', '$cityTrimmed'],
        },
        chosenLocationNormalized: {
          $toLower: {
            $regexReplace: {
              input: {
                $cond: [{ $ne: ['$localityTrimmed', ''] }, '$localityTrimmed', '$cityTrimmed'],
              },
              regex: '\\s+',
              replacement: ' ',
            },
          },
        },
      },
    },
    { $match: { chosenLocationNormalized: { $ne: '' } } },
    {
      $group: {
        _id: '$chosenLocationNormalized',
        propertyCount: { $sum: 1 },
        name: { $first: '$chosenLocationName' },
      },
    },
    { $sort: { propertyCount: -1 } },
    { $limit: 10 },
  ]);

  console.log('[debugLocations] top10=', top);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('[debugLocations] ERR', {
    message: e?.message || String(e),
    code: e?.code,
    name: e?.name,
  });
  process.exitCode = 1;
});

