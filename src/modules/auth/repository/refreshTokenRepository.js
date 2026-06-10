import RefreshToken from "../model/RefreshToken.js";
import { refreshTokenToDTO } from "../dto/authDto.js";

const createRefreshToken = async (data) => {
  const doc = await RefreshToken.create(data);
  return refreshTokenToDTO(doc);
};

const getRefreshTokenByToken = async (token) => {
  const doc = await RefreshToken.findOne({ token });
  if (!doc) return null;
  return refreshTokenToDTO(doc);
};

const deleteRefreshTokensByUserAndProvider = async (userId, provider) => {
  await RefreshToken.deleteMany({ userId, provider });
};

const deleteRefreshTokenByToken = async (token) => {
  await RefreshToken.deleteOne({ token });
};

export {
  createRefreshToken,
  getRefreshTokenByToken,
  deleteRefreshTokensByUserAndProvider,
  deleteRefreshTokenByToken,
};
