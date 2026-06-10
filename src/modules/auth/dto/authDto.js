const refreshTokenToDTO = (doc) => ({
  id: doc._id.toString(),
  token: doc.token,
  userId: doc.userId.toString(),
  provider: doc.provider,
  providerUserId: doc.providerUserId,
  expiresAt: doc.expiresAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export { refreshTokenToDTO };
