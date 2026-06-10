import * as sportRepository from '../repository/sport.js';
import { toDTO } from '../dto/sportDto.js';
import { DomainError } from '../utils/http/httpError.js';
import { httpStatus } from '../utils/http/httpStatus.js';

const toSportDTO = (doc) => toDTO({ ...doc, _id: doc._id });

/**
 * @returns {Promise<Array<{ id: string, code: string, label: string, icon: string | null, color: string | null, order: number }>>}
 */
export async function listSports() {
  const docs = await sportRepository.findAll();
  return docs.map(toSportDTO);
}

/**
 * @param {{ code: string, label: string, icon?: string, color?: string, order?: number }} body
 */
export async function createSport(body) {
  const { code, label } = body;
  if (!code || typeof code !== 'string') {
    throw new DomainError('code is required', httpStatus.BAD_REQUEST);
  }
  if (!label || typeof label !== 'string') {
    throw new DomainError('label is required', httpStatus.BAD_REQUEST);
  }
  const existing = await sportRepository.findByCode(code);
  if (existing) {
    throw new DomainError('Sport with this code already exists', httpStatus.CONFLICT);
  }
  const doc = await sportRepository.create(body);
  return toDTO(doc);
}
