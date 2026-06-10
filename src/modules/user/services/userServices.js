import {
  createUser as repoCreateUser,
  getUserById as repoGetUserById,
  getUser as repoGetUser,
  updateUser as repoUpdateUser,
  deleteUser as repoDeleteUser,
  searchUsersByEmail as repoSearchUsersByEmail,
} from "../repository/userRepository.js";
import { removeReviewsForTarget, removeReviewsByAuthor } from "../../../services/reviewCascadeServices.js";

const createUser = async (data) => {
  return await repoCreateUser(data);
};

const getUserById = async (id) => {
  return await repoGetUserById(id);
};

const getUser = async (filter = {}) => {
  return await repoGetUser(filter);
};

const updateUser = async (id, update) => {
  return await repoUpdateUser(id, update);
};

const deleteUser = async (id) => {
  const deleted = await repoDeleteUser(id);

  await Promise.all([
    removeReviewsForTarget({ targetType: "User", targetId: id }),
    removeReviewsByAuthor(id),
  ]);

  return deleted;
};

const searchUsersByEmail = async (emailQuery, excludeUserIds, limit) => {
  return await repoSearchUsersByEmail(emailQuery, excludeUserIds, limit);
};

export { createUser, getUserById, getUser, updateUser, deleteUser, searchUsersByEmail };
