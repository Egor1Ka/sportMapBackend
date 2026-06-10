import { searchUsersByEmail } from "../modules/user/index.js";
import { getMemberUserIdsByOrg } from "../repository/membershipRepository.js";

const searchUsersExcludingOrgMembers = async (emailQuery, orgId) => {
  const existingMemberIds = await getMemberUserIdsByOrg(orgId);
  const users = await searchUsersByEmail(emailQuery, existingMemberIds, 10);
  const toEmailResult = (user) => ({ id: user.id, email: user.email });
  return users.map(toEmailResult);
};

export { searchUsersExcludingOrgMembers };
