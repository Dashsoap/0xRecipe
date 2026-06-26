/**
 * Benchmark case set for the Fusion-vs-singles harness.
 *
 * Each case is a contract with a ground-truth answer key of planted
 * contradictions (mix of obvious + subtle). The original lease fixture is
 * adapted into the same shape; the rest are dedicated benchmark contracts.
 */
import { LEASE_TEXT, EXPECTED_CONTRADICTIONS } from "../lease.js";
import { CASE as employment } from "./employment.js";
import { CASE as nda } from "./nda.js";
import { CASE as saas } from "./saas.js";

export interface BenchExpected {
  id: string;
  clauseRefs: string;
  conflict: string;
  subtlety?: string;
}

export interface BenchCase {
  id: string;
  name: string;
  text: string;
  expected: BenchExpected[];
}

const lease: BenchCase = {
  id: "lease",
  name: "Residential Lease",
  text: LEASE_TEXT,
  expected: EXPECTED_CONTRADICTIONS.map((e) => ({ ...e })),
};

export const CASES: BenchCase[] = [
  lease,
  employment as unknown as BenchCase,
  nda as unknown as BenchCase,
  saas as unknown as BenchCase,
];
