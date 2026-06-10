import Location from "../models/Location.js";

const getLocationById = async (id) => {
  const doc = await Location.findById(id);
  if (!doc) return null;
  return doc;
};

export { getLocationById };
