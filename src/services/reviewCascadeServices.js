import * as ratingRepo from "../repository/ratingRepository.js";
import * as commentRepo from "../repository/commentRepository.js";

const removeReviewsForTarget = async ({ targetType, targetId }) => {
  await Promise.all([
    ratingRepo.deleteByTarget({ targetType, targetId }),
    commentRepo.deleteByTarget({ targetType, targetId }),
  ]);
};

const removeReviewsByAuthor = async (authorId) => {
  await Promise.all([
    ratingRepo.deleteByAuthor(authorId),
    commentRepo.deleteByAuthor(authorId),
  ]);
};

export { removeReviewsForTarget, removeReviewsByAuthor };
