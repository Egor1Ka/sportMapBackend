const toUserDto = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  email: doc.email,
  avatar: doc.avatar,
  description: doc.description || null,
  address: doc.address || null,
  phone: doc.phone || null,
  website: doc.website || null,
  telegramConnected: !!doc.telegramChatId,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export { toUserDto };
