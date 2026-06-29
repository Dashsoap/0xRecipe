// Test fixture for the contract-review benchmark.
//
// CASE.text is a synthetic, professionally-styled Mutual Non-Disclosure
// Agreement that intentionally embeds seven internal contradictions placed in
// non-adjacent sections. The mix is deliberate: roughly three are "obvious"
// (a concrete number, term, or amount stated one way in one section and
// differently in another) and roughly four are "subtle" (conflicts a careful
// reviewer catches but a quick single read often misses, requiring two distant
// clauses to be connected). The fixture measures whether a review panel can
// discriminate between easy and hard catches.
//
// All parties, places, and figures are generic and fictional. There are no
// real names, companies, brands, or addresses.

export const CASE = {
  id: "nda",
  name: "Mutual Non-Disclosure Agreement",
  text: `MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement (this "Agreement") is entered into as of the Effective Date by and between two parties, each referred to individually as a "Party" and collectively as the "Parties." Each Party may act as a "Disclosing Party" when it furnishes information and as a "Receiving Party" when it receives information. The Parties wish to evaluate a potential business relationship (the "Purpose") and, in connection therewith, anticipate that each may disclose to the other certain confidential and proprietary information. In consideration of the mutual covenants set forth below, the Parties agree as follows.

SECTION 1. DEFINITIONS.
"Confidential Information" means any non-public information disclosed by the Disclosing Party to the Receiving Party, whether in written, electronic, or other tangible form, that is marked or otherwise identified as confidential at the time of disclosure. Information disclosed orally or visually shall constitute Confidential Information only if it is identified as confidential at the time of disclosure and is reduced to writing, summarized in reasonable detail, and delivered to the Receiving Party within fifteen (15) days following the original oral or visual disclosure. "Representatives" has the meaning set forth in Section 4.

SECTION 2. EXCLUSIONS.
Confidential Information does not include information that: (a) is or becomes publicly available through no act or omission of the Receiving Party; (b) was rightfully in the Receiving Party's possession, free of any obligation of confidentiality, prior to its disclosure by the Disclosing Party; (c) is rightfully obtained by the Receiving Party from a third party without restriction and without breach of any obligation owed to the Disclosing Party; or (d) is independently developed by the Receiving Party without use of or reference to the Disclosing Party's Confidential Information. The Receiving Party bears the burden of demonstrating, by reasonable documentation, that one of the foregoing exclusions applies.

SECTION 3. PERMITTED USE.
The Receiving Party shall use the Confidential Information solely for the Purpose and for no other purpose whatsoever. The Receiving Party acknowledges and agrees that all information disclosed orally shall be deemed Confidential Information from the moment of disclosure, irrespective of whether it is ever confirmed, summarized, or reduced to writing. The Receiving Party shall not, directly or indirectly, use the Confidential Information to compete with the Disclosing Party or for any commercial advantage. Upon completion or abandonment of the Purpose, the Receiving Party shall return or destroy all materials containing Confidential Information within ten (10) days. The Receiving Party shall not reverse engineer, decompile, or disassemble any item furnished hereunder.

SECTION 4. DISCLOSURE TO REPRESENTATIVES.
The Receiving Party may disclose Confidential Information only to its employees and outside legal counsel (collectively, "Representatives") who have a bona fide need to know such information for the Purpose and who are bound by written confidentiality obligations no less protective than those contained in this Agreement. The Receiving Party shall remain fully responsible for any act or omission of its Representatives that would constitute a breach of this Agreement if committed by the Receiving Party. Any unauthorized disclosure by a Representative shall entitle the Disclosing Party to recover liquidated damages in the amount of fifty thousand dollars ($50,000) per occurrence.

SECTION 5. TERM OF AGREEMENT.
This Agreement shall commence on the Effective Date and shall remain in full force and effect for a period of two (2) years, unless earlier terminated by either Party upon thirty (30) days' prior written notice to the other Party. Termination of this Agreement shall not relieve either Party of obligations that accrued prior to the effective date of termination. The confidentiality and non-use obligations of the Parties shall survive the expiration or termination of this Agreement for the period set forth in Section 7.

SECTION 6. SURVIVAL OF OBLIGATIONS.
The obligations of confidentiality and non-use set forth in this Agreement shall survive the expiration or termination of this Agreement and shall continue in effect for a period of five (5) years following such expiration or termination. Notwithstanding anything to the contrary in Section 2, any information that was marked "Confidential" at the time of its disclosure shall remain subject to this Agreement and shall continue to be treated as Confidential Information by the Receiving Party even after such information has entered the public domain.

SECTION 7. RETURN AND DESTRUCTION OF MATERIALS.
Upon the written request of the Disclosing Party, the Receiving Party shall, within thirty (30) days of its receipt of such request, return to the Disclosing Party or destroy all Confidential Information then in its possession or control, together with all copies, extracts, notes, and derivative materials thereof. Upon request, an authorized officer of the Receiving Party shall certify in writing that the Receiving Party has fully complied with the requirements of this Section.

SECTION 8. GOVERNING LAW AND JURISDICTION.
This Agreement shall be governed by and construed in accordance with the laws of the jurisdiction in which the Disclosing Party maintains its principal place of business, without regard to its conflict-of-laws principles. The Parties irrevocably consent to the exclusive jurisdiction of the state and federal courts located in the City of [Placeholder] for the resolution of any dispute arising out of or relating to this Agreement, and waive any objection to venue in such courts.

SECTION 9. REMEDIES AND INJUNCTIVE RELIEF.
The Parties acknowledge that a breach or threatened breach of this Agreement may cause irreparable harm for which monetary damages would be an inadequate remedy, and that the non-breaching Party shall be entitled to seek injunctive or other equitable relief without the necessity of posting a bond or proving actual damages. In addition to any equitable relief, each breach of this Agreement shall entitle the non-breaching Party to recover liquidated damages in the amount of one hundred thousand dollars ($100,000) per breach, which the Parties agree represents a reasonable estimate of the harm likely to be caused and does not constitute a penalty.

SECTION 10. NOTICES.
All notices required or permitted under this Agreement shall be in writing and shall be deemed duly given when delivered personally, when sent by a nationally recognized overnight courier, or when transmitted by electronic mail with confirmation of receipt, in each case to the address most recently designated in writing by the receiving Party. A Party may change its designated address or contact for notices by delivering written notice to the other Party in accordance with this Section.

SECTION 11. ASSIGNMENT.
Neither Party may assign or otherwise transfer this Agreement, in whole or in part, whether by operation of law or otherwise, without the prior written consent of the other Party, except that either Party may assign this Agreement, without such consent, to a successor in connection with a merger, acquisition, reorganization, or sale of all or substantially all of its assets. Any purported assignment in violation of this Section shall be null and void.

SECTION 12. MISCELLANEOUS.
This Agreement constitutes the entire agreement between the Parties with respect to its subject matter and supersedes all prior and contemporaneous understandings, whether written or oral. The Parties acknowledge that the three (3) year term of this Agreement reflects the anticipated duration of their collaboration. In no event shall the confidentiality obligations of either Party extend beyond four (4) years from the Effective Date. No amendment to or waiver of any provision of this Agreement shall be effective unless set forth in a writing signed by both Parties. If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect. This Agreement may be executed in counterparts, each of which shall be deemed an original and all of which together shall constitute one and the same instrument.

IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.

DISCLOSING PARTY: ____________________________

RECEIVING PARTY: _____________________________`,
  expected: [
    {
      id: "agreement-term-length",
      clauseRefs: "§5 vs §12",
      conflict:
        "Section 5 fixes the term of the Agreement at two (2) years, while Section 12 refers to the 'three (3) year term of this Agreement.'",
      subtlety: "obvious",
    },
    {
      id: "return-deadline",
      clauseRefs: "§3 vs §7",
      conflict:
        "Section 3 requires materials containing Confidential Information to be returned or destroyed within ten (10) days of completing the Purpose, while Section 7 sets the return/destruction deadline at thirty (30) days from a written request.",
      subtlety: "obvious",
    },
    {
      id: "liquidated-damages-amount",
      clauseRefs: "§4 vs §9",
      conflict:
        "Section 4 sets liquidated damages at fifty thousand dollars ($50,000) per occurrence for an unauthorized disclosure by a Representative, while Section 9 sets liquidated damages at one hundred thousand dollars ($100,000) for each breach, so a Representative's disclosure triggers two conflicting amounts.",
      subtlety: "obvious",
    },
    {
      id: "oral-disclosure-confidentiality",
      clauseRefs: "§1 vs §3",
      conflict:
        "Section 1 makes orally disclosed information Confidential only if it is reduced to writing and delivered within fifteen (15) days, but Section 3 deems all orally disclosed information Confidential from the moment of disclosure regardless of any written confirmation.",
      subtlety: "subtle",
    },
    {
      id: "survival-cross-reference",
      clauseRefs: "§5 vs §7",
      conflict:
        "Section 5 directs the reader to Section 7 for the survival period of the confidentiality obligations, but Section 7 governs only return and destruction of materials and states no survival period; the actual survival period lives in Section 6.",
      subtlety: "subtle",
    },
    {
      id: "public-domain-carveout",
      clauseRefs: "§2 vs §6",
      conflict:
        "Section 2 excludes information that becomes publicly available from the definition of Confidential Information, but Section 6 keeps information marked 'Confidential' subject to the Agreement even after it has entered the public domain.",
      subtlety: "subtle",
    },
    {
      id: "survival-period-cap",
      clauseRefs: "§6 vs §12",
      conflict:
        "Section 6 makes the obligations survive five (5) years after termination, which (added to the two-year term in Section 5) can run roughly seven years from the Effective Date, yet Section 12 caps all confidentiality obligations at four (4) years from the Effective Date.",
      subtlety: "subtle",
    },
  ],
} as const;
