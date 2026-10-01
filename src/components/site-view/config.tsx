import LabMark from '../Mark';

/* This product's identity for the Simple view. The mark is the registry's own drawing, the same
 * one the Console masthead, the footer and the browser tab draw. */
export const SV_KEY = 'compound-evals';
export const SV_NAME = 'Compound Evals';

export function Mark({ size = 24 }: { size?: number }) {
  return <span className="sv-mark" style={{ width: size, height: size }}><LabMark className="sv-mark-svg" /></span>;
}
