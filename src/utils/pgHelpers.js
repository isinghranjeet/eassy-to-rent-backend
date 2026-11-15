// src/utils/pgHelpers.js

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const getCoordinatesByCity = (city) => {
  const cityCoordinates = {
    chandigarh: { lat: 30.7333, lng: 76.7794 },
    mohali: { lat: 30.7046, lng: 76.7179 },
    panchkula: { lat: 30.6942, lng: 76.8606 },
    kharar: { lat: 30.7463, lng: 76.6468 },
    ropar: { lat: 30.9686, lng: 76.5271 },
    zirakpur: { lat: 30.6442, lng: 76.8186 },
    noida: { lat: 28.5355, lng: 77.391 },
    faridabad: { lat: 28.4089, lng: 77.3178 },
    delhi: { lat: 28.7041, lng: 77.1025 },
    gurgaon: { lat: 28.4595, lng: 77.0266 },
    lucknow: { lat: 26.8467, lng: 80.9462 },
    jaipur: { lat: 26.9124, lng: 75.7873 },
  };

  const cityKey = city?.toLowerCase().trim();
  return cityCoordinates[cityKey] || { lat: 30.7333, lng: 76.7794 };
};

const getYouTubeEmbedUrl = (url) => {
  if (!url) return null;
  let embedUrl = url;

  if (url.includes('youtube.com/watch?v=')) {
    embedUrl = url.replace('watch?v=', 'embed/');
  } else if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1]?.split('?')[0];
    embedUrl = `https://www.youtube.com/embed/${videoId}`;
  } else if (url.includes('vimeo.com/') && !url.includes('player.vimeo.com')) {
    const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
    embedUrl = `https://player.vimeo.com/video/${videoId}`;
  }

  return embedUrl;
};

const syncRoomInventoryFromCounts = (payload, existingListing = null) => {
  const hasRoomFields =
    payload.totalRooms !== undefined ||
    payload.availableRooms !== undefined ||
    payload.numberOfRooms !== undefined ||
    payload.roomTypes !== undefined ||
    payload.roomInventory !== undefined;

  if (!hasRoomFields) return;

  const basePrice = Number(payload.price ?? existingListing?.price ?? 0);
  const roomTypes =
    Array.isArray(payload.roomTypes) && payload.roomTypes.length > 0
      ? payload.roomTypes
      : Array.isArray(existingListing?.roomTypes) && existingListing.roomTypes.length > 0
      ? existingListing.roomTypes
      : ['Single'];

  const rawTotal =
    payload.totalRooms ??
    payload.numberOfRooms ??
    existingListing?.totalRooms ??
    existingListing?.numberOfRooms ??
    0;
  const totalRooms = Math.max(0, Number(rawTotal));

  const rawAvail =
    payload.availableRooms !== undefined
      ? Number(payload.availableRooms)
      : existingListing?.availableRooms !== undefined
      ? Number(existingListing.availableRooms)
      : totalRooms;
  const availableRooms = Math.max(0, rawAvail);

  payload.totalRooms = Math.max(totalRooms, availableRooms);
  payload.availableRooms = availableRooms;
  payload.numberOfRooms = Math.max(1, payload.totalRooms);
  payload.availability = availableRooms > 0 ? 'available' : 'sold-out';

  const existingInv =
    payload.roomInventory ||
    (existingListing?.roomInventory instanceof Map
      ? Object.fromEntries(existingListing.roomInventory)
      : existingListing?.roomInventory) ||
    {};

  const keys = Object.keys(existingInv).length > 0 ? Object.keys(existingInv) : roomTypes;
  const count = keys.length || 1;
  const baseTotal = Math.floor(payload.totalRooms / count);
  const remTotal = payload.totalRooms % count;
  const baseAvail = Math.floor(payload.availableRooms / count);
  const remAvail = payload.availableRooms % count;

  const syncedInventory = {};
  keys.forEach((key, idx) => {
    const prev = existingInv[key] || {};
    syncedInventory[key] = {
      price: Number(prev.price || basePrice),
      total: baseTotal + (idx < remTotal ? 1 : 0),
      available: baseAvail + (idx < remAvail ? 1 : 0),
    };
  });

  payload.roomInventory = syncedInventory;
};

const normalizeListingRooms = (listingObj) => {
  const copy = { ...listingObj };
  syncRoomInventoryFromCounts(copy, listingObj);
  return copy;
};

module.exports = {
  calculateDistance,
  getCoordinatesByCity,
  getYouTubeEmbedUrl,
  syncRoomInventoryFromCounts,
  normalizeListingRooms,
};