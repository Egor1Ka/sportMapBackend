import User from "../model/User.js";
import { toUserDto } from "../dto/userDto.js";

const createUser = async (data) => {
  const doc = await User.create(data);
  return toUserDto(doc);
};

const getUserById = async (id) => {
  const doc = await User.findById(id);
  if (!doc) return null;
  return toUserDto(doc);
};

const getUser = async (filter = {}) => {
  const doc = await User.findOne(filter);
  if (!doc) return null;
  return toUserDto(doc);
};

const updateUser = async (id, update) => {
  const doc = await User.findByIdAndUpdate(id, update, { new: true });
  if (!doc) return null;
  return toUserDto(doc);
};

const deleteUser = async (id) => {
  const doc = await User.findByIdAndDelete(id);
  if (!doc) return null;
  return toUserDto(doc);
};

const searchUsersByEmail = async (emailQuery, excludeUserIds = [], limit = 10) => {
  const regex = new RegExp(emailQuery, "i");
  const docs = await User.find({
    email: regex,
    _id: { $nin: excludeUserIds },
  }).limit(limit);
  const toDto = (doc) => toUserDto(doc);
  return docs.map(toDto);
};

export { createUser, getUserById, getUser, updateUser, deleteUser, searchUsersByEmail };
