// Test fixture for the contract-review benchmark.
//
// CASE.text is a synthetic, professionally-styled employment agreement that
// intentionally embeds seven hard internal contradictions placed in
// non-adjacent sections. The mix is deliberate: roughly half are obvious
// (a concrete number or term stated two different ways) and roughly half are
// subtle (defects a careful reviewer connects across distant clauses but a
// quick single read often misses). The fixture is used to measure how
// reliably the review panel flags every planted conflict and to discriminate
// between shallow and careful reviewers.
//
// All parties, places, and figures are generic and fictional. There are no
// real names, companies, brands, or addresses.

export const CASE = {
  id: "employment",
  name: "Employment Agreement",
  text: `EMPLOYMENT AGREEMENT

This Employment Agreement (the "Agreement") is entered into as of the Effective Date by and between the company identified in the signature block ("the Company") and the undersigned individual ("the Employee"), collectively the "Parties." In consideration of the mutual covenants set forth below, the Parties agree as follows.

SECTION 1. POSITION AND DUTIES.
The Company employs the Employee in the position described in the Employee's offer of employment, and the Employee shall perform the duties customarily associated with that position together with such other lawful duties as the Company may reasonably assign. The Employee shall devote substantially all business time and attention to the affairs of the Company.

SECTION 2. TERM OF EMPLOYMENT.
Employment under this Agreement commences on the Commencement Date and continues until terminated in accordance with the provisions hereof. The employment relationship is for no fixed period and may be ended by either Party as set forth in Section 14. The Employee may voluntarily resign at any time upon not less than thirty (30) days' prior written notice to the Company.

SECTION 3. BASE COMPENSATION.
The Company shall pay the Employee an annual base salary of One Hundred Forty-Five Thousand Dollars ($145,000.00) (the "Base Salary"), payable in arrears in accordance with the Company's regular payroll practices and subject to all applicable withholdings and deductions. The Base Salary shall be reviewed by the Company from time to time but shall not be reduced without the Employee's prior written consent.

SECTION 4. ANNUAL PERFORMANCE BONUS.
The Employee shall be eligible for an annual performance bonus with a target equal to twenty percent (20%) of the Base Salary, payable upon the achievement of objectives established by the Company in its reasonable discretion. Any bonus that has not been paid as of the date employment ends shall be deemed forfeited upon termination of employment for any reason, and the Employee shall thereafter have no claim to any such amount.

SECTION 5. HOURS OF WORK.
The Employee's position is full-time and is based upon a standard workweek of forty (40) hours. The Employee acknowledges that the role may from time to time require additional hours reasonably necessary to fulfill the Employee's responsibilities, for which no compensation shall be owed beyond the Base Salary.

SECTION 6. PAID VACATION.
The Employee shall accrue paid vacation at a rate providing twenty (20) days of paid vacation for each full calendar year of service, prorated for partial years. Vacation shall be scheduled with reasonable advance notice and remains subject to the Company's operational requirements.

SECTION 7. SICK AND PERSONAL LEAVE.
In addition to paid vacation, the Employee shall be entitled to paid sick leave and personal leave in accordance with the Company's written policies and applicable law. The Company may require reasonable documentation to substantiate any extended or recurring absence.

SECTION 8. WORK SCHEDULE AND ATTENDANCE.
Except as otherwise approved in writing by the Company, the Employee shall be present at the Company's premises from 9:00 a.m. to 6:00 p.m., Monday through Friday, less an unpaid meal period of thirty (30) minutes on each such day. The Employee shall accurately record attendance in the manner prescribed by the Company.

SECTION 9. EMPLOYEE BENEFITS.
The Employee shall be eligible to participate in the Company's health, retirement, and other benefit plans on the same terms as similarly situated employees, subject to the governing plan documents. For reference, the Employee's standard paid vacation entitlement under the Company's leave program is fifteen (15) days per calendar year.

SECTION 10. CONFIDENTIALITY.
The Employee acknowledges access to confidential and proprietary information of the Company ("Confidential Information"), including trade secrets, business plans, customer and supplier lists, pricing, and financial data. The Employee shall not, during or after employment, use or disclose any Confidential Information except as required to perform the Employee's duties or as compelled by valid legal process. The obligations in this Section shall survive the termination of employment indefinitely.

SECTION 11. INTELLECTUAL PROPERTY ASSIGNMENT.
The Employee agrees that all inventions, works of authorship, and other intellectual property conceived or developed by the Employee within the scope of employment ("Work Product") shall be the sole and exclusive property of the Company. The Employee hereby irrevocably assigns to the Company all right, title, and interest in and to the Work Product and shall execute such further documents as the Company may reasonably request to perfect that ownership.

SECTION 12. NON-COMPETITION.
During employment and for a period of twelve (12) months following the Termination Date (the "Restricted Period"), the Employee shall not, within the City of [Placeholder] or any market in which the Company actively conducts business, own, manage, operate, or provide services to any business that directly competes with the Company. The Employee acknowledges that this restriction is reasonable in scope and duration and is necessary to protect the legitimate interests of the Company.

SECTION 13. NON-SOLICITATION.
During the Restricted Period, the Employee shall not, directly or indirectly, solicit, induce, or attempt to induce any employee, customer, or supplier of the Company to terminate or curtail its relationship with the Company, regardless of which person first initiates the contact.

SECTION 14. TERMINATION.
Either Party may terminate this Agreement for convenience upon not less than sixty (60) days' prior written notice to the other Party. The Company may also terminate the Employee's employment immediately for Cause, which includes material breach of this Agreement, dishonesty, conviction of a crime involving moral turpitude, or willful misconduct injurious to the Company. Upon any termination for Cause, the Employee shall remain entitled to the severance benefits set forth in Section 16.

SECTION 15. FINAL COMPENSATION AND ACCRUED AMOUNTS.
Upon any termination of employment, the Company shall pay the Employee all accrued and unpaid base salary earned through the Termination Date, calculated at the annual rate of One Hundred Thirty-Five Thousand Dollars ($135,000.00), together with any accrued and unused vacation that is required to be paid out under applicable law. Such amounts shall be paid on or before the next regular payroll date following the Termination Date.

SECTION 16. SEVERANCE.
If the Company terminates the Employee's employment without Cause, the Company shall pay the Employee severance equal to six (6) months of the Employee's base salary, together with a pro-rata portion of the annual performance bonus for the year in which the termination occurs. No severance of any kind shall be payable if the Employee's employment is terminated for Cause or if the Employee resigns voluntarily. Payment of any severance is conditioned upon the Employee's execution and non-revocation of a general release of claims in favor of the Company.

SECTION 17. RETURN OF COMPANY PROPERTY.
Upon termination of employment for any reason, the Employee shall promptly return to the Company all property, documents, equipment, and Confidential Information in the Employee's possession or control, and shall not retain any copies thereof except as authorized in writing by the Company.

SECTION 18. SURVIVAL.
The Employee's obligations under Section 10 (Confidentiality) and Section 11 (Intellectual Property Assignment) shall survive the termination of this Agreement indefinitely. The Employee's obligations under Section 12 (Non-Competition) shall continue in full force and effect for the Restricted Period, which the Parties confirm for the avoidance of doubt shall be twenty-four (24) months following the Termination Date.

SECTION 19. GENERAL PROVISIONS.
This Agreement constitutes the entire understanding of the Parties with respect to its subject matter and supersedes all prior agreements relating thereto. It may be amended only by a writing signed by both Parties. If any provision is held unenforceable, the remaining provisions shall continue in full force and effect. This Agreement shall be governed by the laws of the jurisdiction in which the Company maintains its principal place of business.

IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.

THE COMPANY: ____________________________

THE EMPLOYEE: ___________________________`,
  expected: [
    {
      id: "salary-amount",
      clauseRefs: "§3 vs §15",
      conflict:
        "The base compensation clause sets the annual base salary at $145,000.00 while the final-compensation clause calculates accrued salary at an annual rate of $135,000.00.",
      subtlety: "obvious",
    },
    {
      id: "vacation-days",
      clauseRefs: "§6 vs §9",
      conflict:
        "The paid-vacation clause grants twenty (20) days of vacation per year while the benefits clause states the standard vacation entitlement is fifteen (15) days.",
      subtlety: "obvious",
    },
    {
      id: "termination-notice",
      clauseRefs: "§2 vs §14",
      conflict:
        "Employee-initiated departure requires thirty (30) days' notice under the term clause but sixty (60) days' notice to terminate for convenience under the termination clause.",
      subtlety: "obvious",
    },
    {
      id: "restricted-period-duration",
      clauseRefs: "§12 vs §18",
      conflict:
        "The defined 'Restricted Period' is twelve (12) months in the non-competition clause but is reconfirmed as twenty-four (24) months in the survival clause.",
      subtlety: "subtle",
    },
    {
      id: "bonus-forfeiture-vs-severance",
      clauseRefs: "§4 vs §16",
      conflict:
        "The bonus clause forfeits any unpaid bonus on termination for any reason, yet the severance clause pays a pro-rata bonus on termination without Cause.",
      subtlety: "subtle",
    },
    {
      id: "cause-severance-crossref",
      clauseRefs: "§14 vs §16",
      conflict:
        "The termination clause states the Employee remains entitled to severance under Section 16 even upon termination for Cause, but Section 16 bars any severance when termination is for Cause.",
      subtlety: "subtle",
    },
    {
      id: "workweek-hours",
      clauseRefs: "§5 vs §8",
      conflict:
        "The hours clause fixes a forty (40) hour workweek, but the prescribed 9:00 a.m. to 6:00 p.m. schedule less a 30-minute unpaid meal computes to 42.5 worked hours per week.",
      subtlety: "subtle",
    },
  ],
} as const;
