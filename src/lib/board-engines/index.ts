export * from './types';
export * from './grading';
export { calculateNCTB } from './nctb-engine';
export { calculateCBSE } from './cbse-engine';
export {
  calculateFBISE,
  calculateFBISEPart1Only,
  normalizeFbiseSubjectCode,
  type FbiseInput,
} from './fbise-engine';

import { Board } from './types';
import { calculateNCTB } from './nctb-engine';
import { calculateCBSE } from './cbse-engine';
import { calculateFBISE } from './fbise-engine';

export const BoardEngines = {
  NCTB: calculateNCTB,
  CBSE: calculateCBSE,
  FBISE: calculateFBISE,
} as const;

export function getBoardEngine(board: Board){
  const engine = BoardEngines[board];
  if(!engine) throw new Error(`Unsupported board: ${board}`);
  return engine;
}
