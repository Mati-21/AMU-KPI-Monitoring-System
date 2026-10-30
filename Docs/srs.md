# AMU KPI Monitoring System
## Complete Functional Requirements Specification

**Project:** Arba Minch University KPI Monitoring System
**Document Type:** Functional Requirements Specification
**System Scope:** University-wide KPI planning, cascading, monitoring, evaluation, and performance reporting

---

# 1. Introduction

## 1.1 Purpose of the System

The AMU KPI Monitoring System is intended to help Arba Minch University plan, distribute, monitor, and evaluate institutional performance through a hierarchical Key Performance Indicator (KPI) management process.

The system will allow the university to define institutional KPIs at the highest organizational level and cascade them down through subordinate offices until the appropriate offices responsible for implementing and achieving those KPIs are reached.

Each office will have clearly defined responsibilities, baselines, targets, measurement methods, and performance weights.

The system will also automatically calculate performance achievement, aggregate results across organizational levels, and provide university management with a clear picture of institutional performance.

## 1.2 Main Objectives

The system shall:

1. Digitize the university's KPI planning and monitoring process.
2. Represent the university's organizational hierarchy.
3. Allow KPIs to be created and managed centrally.
4. Support cascading KPIs from higher-level offices to subordinate offices.
5. Allow the assigning office to establish the official baseline and target for each subordinate office.
6. Support different KPI measurement types.
7. Automatically calculate KPI achievement.
8. Distinguish improvement achievement from final target achievement.
9. Aggregate subordinate office performance into parent office performance where appropriate.
10. Calculate weighted performance scores.
11. Support evidence submission and verification.
12. Provide dashboards and reports at office, college, institute, and university levels.
13. Maintain a complete history of KPI assignments, target changes, reported results, and approvals.

---

# 2. University Organizational Structure

## 2.1 Organizational Hierarchy

Arba Minch University has a hierarchical organizational structure that begins with the President's Office.

Under the President's Office are other offices, such as Vice Presidents' Offices. Beneath these offices are institutes and colleges, which may oversee faculties, departments, and other subordinate offices.

The hierarchy continues through several levels depending on the university's actual organizational structure.

The system must support a flexible organizational hierarchy rather than assuming that every office follows the same number of levels.

Example:

- President's Office
  - Vice President for Academic Affairs
    - College of Natural Sciences
      - Department of Biology
      - Department of Chemistry
    - College of Social Sciences
      - Department of Sociology
      - Department of Psychology
  - Vice President for Research
    - Research Institutes
    - Research Centers
  - Vice President for Administration and Development
    - Human Resources Office
    - Finance Office
    - Procurement Office

This is an illustrative structure. Authorized administrators must be able to configure the actual university structure.

## 2.2 Organizational Structure Requirements

The system shall:

1. Allow authorized administrators to create organizational units.
2. Allow an organizational unit to have a parent office.
3. Allow an organizational unit to have multiple subordinate offices.
4. Support different organizational levels and depths.
5. Allow an office to be moved to another parent office when the university structure changes, subject to appropriate authorization.
6. Maintain historical organizational relationships so that previous KPI reports remain associated with the structure under which they were produced.
7. Identify the responsible head or manager of each office.
8. Support active and inactive organizational units.
9. Prevent invalid hierarchical relationships, such as an office being its own parent.
10. Define which offices can assign KPIs to which subordinate offices.

## 2.3 Office Responsibilities

Every office must have a clearly defined organizational identity and responsibility.

An office may:

- Receive KPIs from its parent office.
- Review its assigned KPIs.
- Receive responsibility for subordinate offices.
- Distribute its assigned KPI responsibilities to its own subordinate offices.
- Report actual performance.
- Submit supporting evidence.
- Review the performance of its subordinate offices.
- Monitor whether its subordinate offices are achieving their assigned targets.

An office's ability to assign KPIs must depend on its position in the organizational hierarchy and the permissions granted to its users.

---

# 3. KPI Management

## 3.1 KPI Definition

A Key Performance Indicator (KPI) is a measurable indicator used to evaluate how effectively an office or institution is achieving a particular objective.

Examples include:

- Number of research publications.
- Number of graduated students.
- Student pass rate.
- Graduate employment rate.
- Student-to-teacher ratio.
- Level of digital transformation.
- Research income generated.
- Number of unresolved audit findings.

## 3.2 KPI Creation

The system shall allow authorized users to create and manage institutional KPIs.

Each KPI must contain:

1. KPI name.
2. KPI code or unique identifier.
3. KPI description.
4. Strategic objective.
5. KPI measurement type.
6. Unit of measurement.
7. Performance direction.
8. Measurement formula, where applicable.
9. Data source.
10. Reporting frequency.
11. Evidence requirements.
12. Aggregation method.
13. Scoring method.
14. Responsible or coordinating office, where applicable.
15. KPI importance weight when included in a performance contract.

## 3.3 KPI Measurement Types

The system must support the following six measurement types:

1. Number / Count
2. Percentage
3. Ratio
4. Stage
5. Category
6. Money

Each measurement type must have its own data-entry fields, validation rules, calculation methods, and aggregation rules.

## 3.4 Performance Direction

Every KPI must specify whether higher or lower values represent better performance.

**Higher-is-better examples:**

- Research publications.
- Graduation rate.
- Employment rate.
- Research income.

**Lower-is-better examples:**

- Student dropout rate.
- Number of complaints.
- Examination errors.
- Operating costs.
- Student-to-teacher ratio, when the objective is to reduce the ratio.

The system must not assume that higher values are always better.

The performance direction must influence the calculation of improvement and target achievement.

---

# 4. KPI Cascading and Responsibility Distribution

## 4.1 General Cascading Principle

The system shall support cascading KPIs from the highest organizational level to subordinate offices.

The President's Office may assign KPIs to Vice Presidents' Offices. Those offices may distribute their responsibilities to colleges, institutes, or other subordinate offices. Colleges and institutes may then distribute responsibilities to their own subordinate offices.

This process continues until the KPI reaches the office responsible for implementing the relevant activity.

The system must support multiple levels of cascading.

## 4.2 KPI Assignment

When an office receives a KPI, it must be able to:

1. View the KPI description.
2. View the strategic objective associated with the KPI.
3. View its assigned baseline.
4. View its assigned target.
5. View its measurement type.
6. View its performance direction.
7. View its reporting frequency.
8. View its assigned importance weight, if applicable.
9. View evidence requirements.
10. View its parent office and assignment history.

## 4.3 Responsibility of the Assigning Office

**The office assigning a KPI to a subordinate office is responsible for establishing that subordinate office's official baseline and target.**

For example:

The President's Office assigns a research publication KPI to the Vice President for Research.

The President's Office establishes:

- The baseline for the Vice President for Research.
- The target for the Vice President for Research.
- The reporting period.
- The measurement method.

When the Vice President for Research distributes the KPI to subordinate institutes, the Vice President for Research becomes responsible for establishing the official baselines and targets for those institutes.

The same principle applies at every level.

The subordinate office does not independently determine or change its approved baseline and target.

However, the subordinate office may:

- Review the assignment.
- View the baseline and target.
- Request clarification.
- Submit a correction request with supporting evidence.
- Accept or acknowledge the assignment, according to the university's approval workflow.

The assigning office must review and approve any requested changes.

## 4.4 Responsibility Allocation

An office may distribute all or part of its assigned responsibility to subordinate offices.

The system must support three situations:

**Situation A: Full distribution**

The parent office distributes its entire responsibility to subordinate offices.

**Situation B: Partial distribution**

The parent office distributes part of its responsibility and retains the remaining responsibility.

**Situation C: No further distribution**

The parent office retains the entire responsibility because the KPI is directly implemented or measured at that level.

The system must explicitly record the amount of responsibility distributed and the amount retained.

## 4.5 Responsibility Reconciliation

For additive KPIs with mutually exclusive and complete subordinate scopes, the system must ensure that:

**Parent responsibility = Sum of subordinate responsibilities + Parent retained responsibility**

Example:

The President's Office assigns the Vice President for Research responsibility for producing 60 additional research publications.

The Vice President for Research distributes the responsibility as follows:

| Office | Assigned improvement |
|---|---:|
| Research Institute A | 20 |
| Research Institute B | 15 |
| Research Institute C | 15 |
| VP Research retained responsibility | 10 |
| **Total** | **60** |

The system must calculate and display the distribution total.

If the distributed and retained responsibilities do not reconcile with the parent's assigned responsibility, the system must flag the difference.

The system must not automatically change official baselines or targets to force the numbers to match.

The responsible assigning office must correct or formally justify the difference.

### Important aggregation condition

Reconciliation is required only when subordinate offices represent non-overlapping and collectively complete parts of the parent's responsibility.

If offices have overlapping responsibilities, or if the parent KPI measures an institution-wide outcome that cannot be divided into independent office contributions, the system must use an appropriate aggregation method instead of blindly adding the values.

## 4.6 KPI Assignment History

The system shall maintain:

- Assigning office.
- Receiving office.
- KPI assigned.
- Baseline assigned.
- Target assigned.
- Responsibility allocated.
- Assignment date.
- Effective reporting period.
- Assignment status.
- User who created the assignment.
- Approval information.
- Previous assignment versions.
- Reasons for modifications.

Approved assignments must not be silently overwritten.

---

# 5. Baseline and Target Management

## 5.1 Baseline Definition

A baseline is the starting performance value against which future improvement is measured.

It represents the office's existing performance before or at the beginning of the target period.

Example:

If an office currently produces 40 research publications per year, its baseline is 40 publications.

## 5.2 Target Definition

A target is the desired performance level that an office is expected to achieve by the end of a specified reporting period.

Example:

If the office currently produces 40 publications and is expected to produce 70, its target is 70.

## 5.3 Assigned Improvement

Assigned improvement is the difference between the baseline and the target.

For higher-is-better KPIs:

**Assigned improvement = Target − Baseline**

Example:

- Baseline: 40 publications.
- Target: 70 publications.
- Assigned improvement: 30 publications.

For lower-is-better KPIs:

**Assigned reduction = Baseline − Target**

Example:

- Baseline: 100 complaints.
- Target: 40 complaints.
- Required reduction: 60 complaints.

## 5.4 Baseline and Target Assignment Requirements

Whenever an office assigns a KPI to a subordinate office, the assignment interface must request the appropriate baseline and target values.

The fields must change dynamically based on the selected KPI measurement type.

The assigning office must:

1. Establish the baseline.
2. Establish the target.
3. Confirm the measurement period.
4. Confirm the measurement unit.
5. Provide or reference supporting baseline evidence.
6. Confirm the target is appropriate for the subordinate office.
7. Save the assignment.
8. Submit it for approval where the workflow requires approval.

## 5.5 Baseline Evidence

The system must support baseline evidence to reduce arbitrary or unsupported baseline values.

Examples include:

- Previous annual performance reports.
- Institutional records.
- Student records.
- Research publication records.
- Financial reports.
- Official assessment results.

The system should store the evidence source, date, description, and attached documents where applicable.

An authorized reviewer should be able to verify the baseline before approving the assignment.

## 5.6 Unknown Baselines

The system must support situations where a reliable baseline is unavailable.

It must not automatically treat an unknown baseline as zero.

In such cases:

- The baseline must be marked as unknown or pending verification.
- The responsible office must provide a justification.
- Improvement achievement must be marked as not calculable until a valid baseline is established.
- Target achievement may still be calculated if the selected target-scoring method permits it.

---

# 6. Performance Achievement Calculations

The system must distinguish between two separate performance measurements.

These measurements answer different questions and must be displayed separately.

## 6.1 Improvement Achievement

Improvement achievement measures how much of the desired improvement from the baseline toward the target has been achieved.

It answers:

**How much progress has the office made from its starting performance toward its desired improvement?**

### Higher-is-better formula

Improvement achievement:

\[
\frac{Actual-Baseline}{Target-Baseline}\times100
\]

Example:

- Baseline = 40 publications.
- Target = 70 publications.
- Actual = 65 publications.

\[
\frac{65-40}{70-40}\times100=83.33\%
\]

The office has achieved 83.33% of its desired improvement.

### Lower-is-better formula

Improvement achievement:

\[
\frac{Baseline-Actual}{Baseline-Target}\times100
\]

Example:

- Baseline = 100 complaints.
- Target = 40 complaints.
- Actual = 38 complaints.

\[
\frac{100-38}{100-40}\times100=103.33\%
\]

The office has achieved 103.33% of its desired improvement.

The result is above 100% because the office has performed better than its target.

## 6.2 Assigned Target Achievement

Assigned target achievement measures performance against the final target assigned to the office.

It answers:

**How close is the office to meeting its assigned final target?**

For a higher-is-better KPI using a minimum target:

\[
\frac{Actual}{Target}\times100
\]

Example:

- Target = 70 publications.
- Actual = 65 publications.

\[
\frac{65}{70}\times100=92.86\%
\]

The office has achieved 92.86% of its assigned target.

For a lower-is-better KPI using a maximum acceptable target:

- If actual is less than or equal to the target, target achievement is 100%.
- If actual is greater than the target, the system may calculate:

\[
\frac{Target}{Actual}\times100
\]

Example:

- Target = 40 complaints.
- Actual = 38 complaints.

The target is achieved, so assigned target achievement is 100%.

Another example:

- Target = 40 complaints.
- Actual = 50 complaints.

\[
\frac{40}{50}\times100=80\%
\]

## 6.3 Displaying Both Measurements

For every applicable KPI, the system should display:

- Baseline.
- Assigned target.
- Actual result.
- Required improvement or reduction.
- Actual improvement achieved.
- Improvement achievement percentage.
- Assigned target achievement percentage.
- Performance status.

Example:

| Measurement | Value |
|---|---:|
| Baseline | 40 |
| Target | 70 |
| Actual | 65 |
| Required improvement | 30 |
| Actual improvement | 25 |
| Improvement achievement | 83.33% |
| Target achievement | 92.86% |

The system must not confuse improvement achievement with assigned target achievement.

## 6.4 Calculation Exceptions

The system must handle the following situations:

1. **Baseline equals target:** Improvement achievement cannot be calculated using the normal formula because the denominator is zero. Use an approved maintenance or tolerance rule.
2. **Unknown baseline:** Improvement achievement is not calculable.
3. **Target equals zero:** Use a specifically configured scoring rule; do not divide by zero.
4. **Negative improvement:** Preserve the negative result because performance may have deteriorated.
5. **Overachievement:** Preserve the raw value above 100%.
6. **Capped scoring:** If the university decides that official scores cannot exceed 100%, retain both the raw score and the capped score.
7. **Missing actual result:** Mark performance as not reported or pending, rather than automatically treating it as zero.

The university must configure whether overachievement is capped for official scoring.

---

# 7. Measurement Type Requirements

# 7.1 Number / Count

## Description

A Number KPI measures the quantity of something.

Examples:

- Number of research publications.
- Number of graduated students.
- Number of research projects.
- Number of training programs.
- Number of complaints.
- Number of examination errors.

## Assignment Fields

The assigning office must enter:

- Baseline count.
- Target count.

The system calculates the required improvement or reduction automatically.

## Higher-is-better example

| Measurement | Value |
|---|---:|
| Baseline publications | 40 |
| Target publications | 70 |
| Actual publications | 65 |
| Required improvement | 30 |
| Improvement achieved | 25 |
| Improvement achievement | 83.33% |
| Target achievement | 92.86% |

## Lower-is-better example

A KPI measures the number of unresolved complaints.

| Measurement | Value |
|---|---:|
| Baseline complaints | 100 |
| Target complaints | 40 |
| Actual complaints | 50 |
| Required reduction | 60 |
| Actual reduction | 50 |
| Improvement achievement | 83.33% |
| Target achievement | 80% |

## Aggregation Requirements

For additive count KPIs, the parent office may calculate its result by summing subordinate office values when their scopes are mutually exclusive and complete.

The system must prevent duplicate reporting of the same activity across offices.

---

# 7.2 Percentage

## Description

A Percentage KPI measures a proportion or rate.

Examples:

- Student pass rate.
- Graduation rate.
- Employment rate.
- Student dropout rate.
- Budget utilization rate.
- Staff training completion rate.

## Assignment Fields

The system must collect:

- Baseline numerator.
- Baseline denominator.
- Calculated baseline percentage.
- Target percentage.

The system must calculate the baseline percentage automatically.

\[
Percentage=\frac{Numerator}{Denominator}\times100
\]

The system should also collect the target as a percentage, with an appropriate target numerator or denominator when required by the KPI definition.

## Why numerator and denominator are necessary

A percentage alone does not tell the complete story.

Example:

College A has 80% pass rate:

- Passed students: 800.
- Total assessed students: 1,000.

College B has 90% pass rate:

- Passed students: 90.
- Total assessed students: 100.

If the university simply averages the percentages:

\[
\frac{80+90}{2}=85\%
\]

This is incorrect for the combined university pass rate.

The correct calculation is:

\[
\frac{800+90}{1000+100}\times100=80.91\%
\]

Therefore, the system must store the numerator and denominator, not only the displayed percentage.

## Higher-is-better example

| Measurement | Value |
|---|---:|
| Baseline | 70% |
| Target | 85% |
| Actual | 84.67% |
| Improvement achievement | 97.80% |
| Target achievement | 99.61% |

## Lower-is-better example

A student dropout rate KPI:

| Measurement | Value |
|---|---:|
| Baseline | 12% |
| Target | 5% |
| Actual | 6% |
| Improvement achievement | 85.71% |
| Target achievement | 83.33% |

## Aggregation Requirements

The parent percentage must be calculated using the total numerator divided by the total denominator.

\[
Parent\ Percentage=
\frac{\sum Numerators}{\sum Denominators}\times100
\]

The system must not calculate the parent result by taking a simple average of subordinate percentages unless the university explicitly configures an approved alternative method.

The numerator and denominator must represent consistent populations and reporting periods.

---

# 7.3 Ratio

## Description

A Ratio KPI measures the relationship between two quantities.

Examples:

- Students per teacher.
- Students per laboratory.
- Research projects per researcher.
- Computers per staff member.

## Assignment Fields

The assigning office must enter:

- Baseline numerator.
- Baseline denominator.
- Calculated baseline ratio.
- Target ratio.

The system calculates the ratio automatically.

\[
Ratio=\frac{Numerator}{Denominator}
\]

## Example

A student-to-teacher ratio:

- Students = 2,000.
- Teachers = 40.

\[
Ratio=\frac{2000}{40}=50
\]

The ratio is 50 students per teacher.

## Lower-is-better example

| Measurement | Value |
|---|---:|
| Baseline ratio | 50 |
| Target ratio | 40 |
| Actual ratio | 41.67 |
| Improvement achievement | 83.33% |
| Target achievement | 96% |

## Higher-is-better example

A research projects-per-researcher KPI:

| Measurement | Value |
|---|---:|
| Baseline ratio | 0.5 |
| Target ratio | 0.8 |
| Actual ratio | 0.75 |
| Improvement achievement | 83.33% |
| Target achievement | 93.75% |

## Aggregation Requirements

The parent ratio must be calculated using the combined numerator and denominator.

\[
Parent\ Ratio=
\frac{\sum Numerators}{\sum Denominators}
\]

The system must not calculate the parent ratio by taking a simple average of subordinate ratios.

The system must prevent division by zero and display the underlying numerator and denominator alongside the calculated ratio.

---

# 7.4 Stage

## Description

A Stage KPI measures progress through a predefined sequence of development or maturity levels.

Examples:

- Digital transformation maturity.
- Research capacity development.
- Quality assurance implementation.
- Institutional system development.

## Example Stage Configuration

| Stage | Description |
|---|---|
| Stage 1 | Initial |
| Stage 2 | Developing |
| Stage 3 | Established |
| Stage 4 | Advanced |
| Stage 5 | Optimized |

The university must be able to configure stage names, descriptions, order, and assessment criteria.

## Assignment Fields

The assigning office selects:

- Baseline stage.
- Target stage.

The subordinate office reports its current achieved stage with supporting evidence.

## Higher-is-better example

- Baseline: Stage 2 — Developing.
- Target: Stage 4 — Advanced.
- Actual: Stage 3 — Established.

If the university has approved equally spaced numerical stage scores:

\[
\frac{3-2}{4-2}\times100=50\%
\]

The office has achieved 50% of its desired stage improvement.

## Lower-is-better example

A risk-severity KPI:

| Category | Score |
|---|---:|
| Critical | 4 |
| High | 3 |
| Moderate | 2 |
| Low | 1 |

- Baseline: Critical (4).
- Target: Low (1).
- Actual: Moderate (2).

\[
\frac{4-2}{4-1}\times100=66.67\%
\]

## Important Stage Requirements

Stages are often ordinal, meaning that they have an order but the distance between stages may not be equal.

Therefore:

1. The system must not automatically assume that every stage transition represents the same amount of improvement.
2. Numerical stage scoring must require university approval.
3. Each stage must have clear assessment criteria.
4. Evidence must support the reported stage.
5. The system must support parent-level aggregation using approved methods.

Possible aggregation methods include:

- Percentage of subordinate offices meeting their assigned stage.
- Distribution of offices across stages.
- Approved weighted stage score.
- Weakest-link rule, where the parent outcome depends on the lowest-performing relevant office.

If no meaningful numerical scoring system is configured, the system should display actual stage, target stage, and whether the target was achieved rather than inventing a percentage.

---

# 7.5 Category

## Description

A Category KPI measures performance using predefined categories.

Examples:

- Poor, Satisfactory, Good, Excellent.
- Not Implemented, Partially Implemented, Fully Implemented.
- Compliant, Partially Compliant, Non-Compliant.
- Yes, No.

## Category Configuration

The system must allow authorized users to configure:

- Category names.
- Category descriptions.
- Category order, if applicable.
- Optional numerical scores.
- Assessment criteria.
- Whether the categories are ordered or binary.

Example:

| Category | Optional score |
|---|---:|
| Poor | 1 |
| Satisfactory | 2 |
| Good | 3 |
| Excellent | 4 |

## Assignment Fields

The assigning office selects:

- Baseline category.
- Target category.

The subordinate office reports its actual category and provides supporting evidence.

## Higher-is-better example

- Baseline: Satisfactory.
- Target: Excellent.
- Actual: Good.

If the university approves numerical category scores:

\[
\frac{3-2}{4-2}\times100=50\%
\]

## Lower-is-better example

A risk classification KPI:

- Baseline: Critical.
- Target: Low.
- Actual: Moderate.

Using the approved scores 4, 1, and 2 respectively:

\[
\frac{4-2}{4-1}\times100=66.67\%
\]

## Binary Category Requirements

For binary categories such as Yes/No, the system must not automatically calculate fractional improvement unless the KPI has a defined population or count.

For example, compliance can be measured as:

\[
Compliance\ Rate=
\frac{Compliant\ Items}{Total\ Applicable\ Items}\times100
\]

The system must support:

- Population-based compliance measurement.
- Strict all-must-pass evaluation, where appropriate.
- Direct category attainment.

## Important Category Requirements

The system must distinguish between:

- Reaching the assigned target category.
- Numerical progress toward the target using an approved scoring scale.

A category must not be treated as a percentage merely because it has an order.

---

# 7.6 Money

## Description

A Money KPI measures financial values.

Examples:

- Research income.
- Institutional revenue.
- Research investment.
- Operating expenditure.
- Outstanding debt.
- Procurement expenditure.

## Assignment Fields

The assigning office must enter:

- Baseline amount.
- Currency.
- Target amount.
- Reporting period.

The system must preserve the currency of the recorded financial value.

## Higher-is-better example

A research income KPI:

| Measurement | Value |
|---|---:|
| Baseline | 10,000,000 ETB |
| Target | 16,000,000 ETB |
| Actual | 15,000,000 ETB |
| Improvement achievement | 83.33% |
| Target achievement | 93.75% |

## Lower-is-better example

An operating expenditure KPI:

| Measurement | Value |
|---|---:|
| Baseline | 10,000,000 ETB |
| Target | 8,000,000 ETB |
| Actual | 8,500,000 ETB |
| Improvement achievement | 75% |
| Target achievement | 94.12% |

## Money Requirements

The system must:

1. Store monetary amounts accurately.
2. Store the currency.
3. Prevent accidental comparison of different currencies.
4. Support a common reporting currency where necessary.
5. Record the exchange rate and date used for conversion.
6. Aggregate only non-overlapping financial contributions.
7. Preserve the original recorded amount and currency.
8. Support evidence such as financial statements and approved reports.

For cost-reduction KPIs, the university should consider associated quality or service indicators to ensure that reducing expenditure does not unintentionally reward reduced service quality.

---

# 8. Parent and Subordinate KPI Performance Aggregation

## 8.1 General Principle

The system must calculate performance at the appropriate organizational level.

A parent office must be able to view the performance of its subordinate offices and, where appropriate, see an aggregated result representing the parent's overall responsibility.

The aggregation method must depend on the KPI measurement type and the relationship between the offices' responsibilities.

## 8.2 Aggregation by Measurement Type

| Measurement type | Recommended aggregation |
|---|---|
| Number / Count | Sum values when scopes are non-overlapping and complete |
| Percentage | Total numerator ÷ total denominator |
| Ratio | Total numerator ÷ total denominator |
| Stage | Approved stage aggregation method |
| Category | Approved category aggregation method |
| Money | Sum values when scopes are non-overlapping and complete |

## 8.3 Parent Dashboard

The parent office should be able to view:

- Its own assigned baseline.
- Its own assigned target.
- Its own actual result.
- Its improvement achievement.
- Its target achievement.
- Its subordinate offices.
- Each subordinate office's baseline.
- Each subordinate office's target.
- Each subordinate office's actual performance.
- Subordinate achievement percentages.
- Total distributed responsibility.
- Retained responsibility.
- Unallocated responsibility, if any.
- Reporting and approval status.

## 8.4 Avoiding Double Counting

The system must distinguish between:

- Direct contributions made by an office.
- Contributions made by subordinate offices.
- Aggregated results received from subordinate offices.

If a parent result already includes subordinate contributions, the system must not add those contributions a second time.

The system must support a clear definition of the reporting scope for every KPI.

---

# 9. KPI Importance Weighting

## 9.1 Purpose of Weighting

Not all KPIs have equal importance.

For example, the university may consider research performance more important than some administrative activities.

The system must allow authorized users to assign importance weights to KPIs within a performance contract.

Example:

| KPI | Weight |
|---|---:|
| Research performance | 30% |
| Student success | 30% |
| Community service | 20% |
| Institutional efficiency | 20% |
| **Total** | **100%** |

## 9.2 Weighting Requirements

The system shall:

1. Allow authorized users to assign weights to KPIs.
2. Validate that the weights for a performance contract total 100%, where the contract requires complete weighting.
3. Display the assigned weight for each KPI.
4. Calculate the weighted contribution of each KPI.
5. Calculate the total weighted performance score.
6. Preserve historical weights when performance contracts are revised.
7. Prevent unauthorized changes to approved weights.

## 9.3 Weighted Performance Calculation

The weighted contribution of a KPI is:

\[
Weighted\ Contribution=
Achievement\ Score\times KPI\ Weight
\]

The total performance score is:

\[
Total\ Score=\sum Weighted\ Contributions
\]

Example:

| KPI | Achievement | Weight | Contribution |
|---|---:|---:|---:|
| Research | 90% | 30% | 27% |
| Student Success | 80% | 30% | 24% |
| Community Service | 100% | 20% | 20% |
| Efficiency | 70% | 20% | 14% |
| **Total** | | **100%** | **85%** |

The final weighted performance score is 85%.

## 9.4 Which Achievement Score Should Be Weighted?

The system must preserve both improvement achievement and assigned target achievement.

The university must decide which one is the official basis for its weighted performance score.

The recommended system design is to support both:

1. Weighted improvement achievement.
2. Weighted assigned target achievement.

The university may designate one as the official institutional performance score while retaining the other for analysis.

## 9.5 KPI Importance Weight vs Responsibility Allocation

These are two different concepts and must not be confused.

**KPI importance weight** represents how important a KPI is compared with other KPIs in an office's performance contract.

Example: Research performance has a weight of 30%.

**Responsibility allocation** represents how much of a particular KPI target is assigned to each subordinate office.

Example: Research Institute A receives responsibility for 20 additional publications.

The system must store and calculate these separately.

## 9.6 Weighting at Different Organizational Levels

Each office may have its own performance contract and KPI weights.

For example:

- The university has its own KPI weights.
- The Vice President for Research has its own KPI weights.
- Each research institute may have its own KPI weights.

The system must not simply add or duplicate the university's KPI weight for every subordinate office.

Each performance contract must have its own valid weighting configuration.

## 9.7 Missing Performance Results

The system must not silently treat an unreported KPI as zero.

If a KPI has no verified result:

- Mark it as missing or pending.
- Display its weight.
- Calculate the percentage of total weight with available results.
- Mark the total score as provisional where necessary.
- Apply the university's approved missing-data policy.

---

# 10. KPI Reporting and Monitoring

## 10.1 Reporting Frequency

The system must support configurable reporting frequencies, such as:

- Monthly.
- Quarterly.
- Semi-annually.
- Annually.
- Custom reporting periods.

The reporting frequency should be configurable for each KPI or performance contract.

## 10.2 Actual Performance Submission

The responsible office must be able to submit its actual performance during the reporting period.

The reporting form must dynamically display the appropriate fields based on the KPI measurement type.

Examples:

- Number: actual count.
- Percentage: actual numerator and denominator.
- Ratio: actual numerator and denominator.
- Stage: actual stage.
- Category: actual category.
- Money: actual amount and currency.

## 10.3 Evidence Submission

The system must allow offices to attach evidence supporting reported results.

Evidence may include:

- Documents.
- PDF reports.
- Excel files.
- Official records.
- Financial statements.
- Assessment reports.
- Other permitted file types.

The system must record:

- Evidence title.
- Evidence description.
- Uploading user.
- Upload date.
- Related KPI.
- Related reporting period.
- Verification status.

## 10.4 Reporting Workflow

A recommended reporting workflow is:

1. Office prepares actual performance data.
2. Office attaches supporting evidence.
3. Office submits the performance report.
4. Responsible reviewer examines the submission.
5. Reviewer approves or rejects the submission.
6. If rejected, the office receives feedback and may resubmit.
7. Approved results become available for aggregation and official reporting.

## 10.5 Reporting Statuses

The system should support statuses such as:

- Not Started.
- Draft.
- Submitted.
- Under Review.
- Revision Required.
- Approved.
- Rejected.
- Overdue.

The university may configure additional statuses according to its approval process.

---

# 11. KPI Assignment and Approval Workflow

## 11.1 Assignment Workflow

A recommended assignment workflow is:

1. Authorized user opens an office's KPI assignment page.
2. User selects the KPI to assign.
3. System displays the KPI definition and measurement type.
4. User selects the receiving subordinate office.
5. System displays the measurement-specific baseline and target fields.
6. User enters the official baseline and target.
7. User enters reporting frequency and other assignment details.
8. User provides or references baseline evidence.
9. System validates the assignment.
10. User submits the assignment.
11. Assignment is approved according to the university's configured approval workflow.
12. Receiving office can view and acknowledge the approved assignment.

## 11.2 Assignment Modification

Approved assignments must not be changed without authorization.

When a baseline or target needs to change:

1. The responsible user initiates a modification request.
2. The reason for modification is recorded.
3. Supporting evidence is provided where required.
4. The authorized reviewer examines the request.
5. The change is approved or rejected.
6. The system stores the old and new values.
7. The system records who approved the change and when.
8. Historical reports must remain traceable to the applicable assignment version.

---

# 12. Dashboards and Performance Views

## 12.1 University-Level Dashboard

The President's Office and authorized university management users should see:

- Overall university performance.
- Total number of institutional KPIs.
- KPIs meeting their targets.
- KPIs below their targets.
- KPIs exceeding their targets.
- KPIs not yet reported.
- Weighted university performance score.
- Improvement achievement score.
- Target achievement score.
- Performance trends.
- Performance by Vice President's Office.
- Performance by college or institute.
- Performance by strategic objective.

## 12.2 Parent Office Dashboard

A parent office should see:

- Its assigned KPIs.
- Its own baseline and targets.
- Its actual performance.
- Its subordinate offices.
- Subordinate KPI assignments.
- Subordinate performance.
- Distributed and retained responsibilities.
- Pending reports.
- Reports awaiting review.
- Performance comparison among subordinate offices.

## 12.3 Subordinate Office Dashboard

A subordinate office should see:

- Its assigned KPIs.
- Its approved baselines.
- Its targets.
- Required improvement.
- Actual performance.
- Improvement achievement.
- Target achievement.
- Reporting deadlines.
- Evidence submission status.
- Review feedback.
- Performance history.

## 12.4 Performance Visualization

The system should provide suitable visualizations, including:

- Progress bars.
- Performance status indicators.
- Bar charts.
- Line charts.
- Comparison charts.
- KPI summary tables.
- Organizational performance breakdowns.
- Historical performance trends.

The system must make it clear whether a visualization represents improvement achievement, target achievement, or a weighted score.

---

# 13. Performance Status and Evaluation

The system should classify performance using university-configured thresholds.

For example:

| Performance achievement | Status |
|---|---|
| 100% or more | Target Achieved |
| 80%–99.99% | Near Target |
| 60%–79.99% | Needs Improvement |
| Below 60% | Poor Performance |
| Not reported | Pending |

These are illustrative thresholds. The university must configure and approve the official thresholds.

The system should also distinguish:

- Below target.
- Exactly at target.
- Above target.
- Not reported.
- Not calculable.
- Pending verification.

For lower-is-better KPIs, the status must follow the KPI's performance direction rather than simply assuming a larger raw value is better.

---

# 14. User Roles and Permissions

The system must support role-based access control.

Possible roles include:

## 14.1 System Administrator

Responsible for:

- Managing system configuration.
- Managing users and roles.
- Managing organizational structure.
- Managing system-wide settings.
- Managing KPI measurement configurations.
- Monitoring system activity.

## 14.2 University Management

Responsible for:

- Reviewing institutional performance.
- Viewing university-level dashboards.
- Reviewing reports.
- Approving decisions assigned to their authority.

## 14.3 Office Head

Responsible for:

- Viewing office assignments.
- Assigning KPIs to authorized subordinate offices.
- Establishing subordinate baseline and target values.
- Monitoring subordinate performance.
- Reviewing submitted results.
- Approving or rejecting reports within their authority.

## 14.4 KPI Coordinator

Responsible for:

- Managing KPI records within the assigned scope.
- Preparing performance reports.
- Monitoring reporting deadlines.
- Coordinating evidence collection.
- Reviewing KPI data where permitted.

## 14.5 Office Staff / Data Submitter

Responsible for:

- Entering actual performance data.
- Attaching evidence.
- Saving draft reports.
- Submitting reports for review.

## 14.6 Auditor / Read-Only Reviewer

Responsible for:

- Viewing authorized KPI information.
- Reviewing historical performance.
- Examining supporting evidence.
- Accessing audit records.
- Not modifying approved records unless explicitly authorized.

Permissions must be restricted by organizational scope. A user should not automatically gain access to every office simply because they have the same general role.

---

# 15. Notifications and Reminders

The system should notify relevant users when:

- A new KPI is assigned.
- An assignment is awaiting approval.
- An assignment is approved or rejected.
- A baseline or target change is requested.
- A reporting deadline is approaching.
- A reporting deadline is missed.
- An office submits a performance report.
- A report requires revision.
- A report is approved or rejected.
- A subordinate office is significantly below its target.

Notifications may be provided through in-system notifications and other channels configured by the university.

---

# 16. Audit Trail and History

The system must maintain a reliable history of important actions.

It must record:

- KPI creation and modification.
- KPI assignment.
- Baseline creation and modification.
- Target creation and modification.
- Responsibility distribution.
- Responsibility retention.
- KPI weight changes.
- Actual performance submissions.
- Evidence uploads.
- Report approvals and rejections.
- Changes to organizational structure.
- User and permission changes.
- Other important administrative actions.

Each audit record should contain:

- User who performed the action.
- Action performed.
- Affected record.
- Previous value, where applicable.
- New value, where applicable.
- Date and time.
- Reason or comment, where required.

Approved historical performance data must remain traceable.

---

# 17. Validation and Business Rules

The system must enforce the following business rules.

1. Every KPI must have a defined measurement type.
2. Every KPI must have a defined performance direction.
3. Every assignment must identify a receiving office.
4. The assigning office must be authorized to assign KPIs to that office.
5. The assigning office establishes the official subordinate baseline and target.
6. A subordinate office cannot directly modify an approved baseline or target.
7. A subordinate office may request a correction through an authorized workflow.
8. Baseline and target values must match the KPI measurement type.
9. Percentage and ratio calculations must use valid numerator and denominator values.
10. The system must prevent division by zero.
11. Stage and category values must belong to their configured lists.
12. Numerical stage or category scoring must require an approved scoring method.
13. Monetary values must have an associated currency.
14. Lower-is-better KPIs must use the correct achievement formulas.
15. Missing results must not automatically be treated as zero.
16. Unknown baselines must not automatically be treated as zero.
17. Parent and subordinate aggregation must follow the configured aggregation method.
18. The system must prevent double counting.
19. Responsibility allocation must be distinguishable from KPI importance weighting.
20. KPI importance weights must satisfy the performance contract's configured total.
21. Approved assignments must not be silently overwritten.
22. Historical performance must remain available after approved changes.
23. Only authorized users may approve assignments and reports.
24. Reports must be associated with the correct KPI and reporting period.
25. Every submitted actual result must follow the applicable verification process.

---

# 18. Suggested Data Structure / Main System Entities

The following entities represent the main information the system needs to manage. They are conceptual requirements, not a final database schema.

| Entity | Purpose |
|---|---|
| OrganizationalUnit | Stores university offices, colleges, institutes, departments, and their hierarchy |
| User | Stores system users |
| Role | Defines user roles |
| Permission | Defines permitted system actions |
| UserOfficeAssignment | Connects users to organizational units and responsibilities |
| StrategicObjective | Stores institutional strategic objectives |
| KPI | Stores KPI definitions |
| KPIUnit | Defines units of measurement |
| KPIStage | Stores configured stages |
| KPICategory | Stores configured categories |
| KPIFormula | Defines calculation rules where needed |
| KPIAssignment | Stores the assignment of a KPI to an office |
| KPIResponsibilityAllocation | Stores distributed and retained responsibilities |
| KPIWeight | Stores KPI importance weights within a performance contract |
| BaselineRecord | Stores official baseline values and evidence references |
| TargetRecord | Stores official target values |
| PerformanceReport | Stores reporting-period performance submissions |
| PerformanceValue | Stores actual values according to measurement type |
| PerformanceEvidence | Stores supporting documents and evidence metadata |
| PerformanceReview | Stores approval and rejection decisions |
| KPIAchievement | Stores calculated improvement and target achievement results |
| AuditLog | Stores important system activity |
| Notification | Stores notifications and reminders |

The final database design should preserve the relationship between an assignment, its baseline, its target, its reporting period, and its historical versions.

---

# 19. End-to-End Example: Research Publications KPI

This example demonstrates the entire process from the university level to subordinate offices.

## 19.1 University KPI Definition

The university creates the KPI:

**KPI Name:** Number of Research Publications

- Measurement type: Number / Count.
- Performance direction: Higher-is-better.
- Reporting frequency: Annual.
- University baseline: 100 publications.
- University target: 160 publications.
- Required improvement: 60 publications.

## 19.2 Assignment to Vice Presidents' Offices

The President's Office assigns the KPI to the relevant offices.

| Office | Baseline | Target | Required improvement |
|---|---:|---:|---:|
| VP Academic Affairs | 40 | 70 | 30 |
| VP Research | 35 | 55 | 20 |
| VP Administration | 25 | 35 | 10 |
| **University total** | **100** | **160** | **60** |

The President's Office establishes the official baseline and target for each receiving office.

## 19.3 VP Academic Affairs Cascades the KPI

The VP Academic Affairs has:

- Baseline: 40 publications.
- Target: 70 publications.
- Required improvement: 30 publications.

The VP Academic Affairs assigns the KPI to subordinate colleges.

| Office | Baseline | Target | Required improvement |
|---|---:|---:|---:|
| College A | 15 | 30 | 15 |
| College B | 15 | 25 | 10 |
| College C | 10 | 15 | 5 |
| **Total** | **40** | **70** | **30** |

The VP Academic Affairs establishes the official baselines and targets for the colleges.

## 19.4 College A Cascades the KPI

College A has:

- Baseline: 15 publications.
- Target: 30 publications.
- Required improvement: 15 publications.

It assigns the KPI to its departments.

| Department | Baseline | Target | Required improvement |
|---|---:|---:|---:|
| Biology | 5 | 11 | 6 |
| Chemistry | 4 | 9 | 5 |
| Physics | 6 | 10 | 4 |
| **Total** | **15** | **30** | **15** |

College A establishes the official baseline and target for each department.

## 19.5 Actual Performance Reporting

At the end of the reporting period:

| Department | Baseline | Target | Actual |
|---|---:|---:|---:|
| Biology | 5 | 11 | 10 |
| Chemistry | 4 | 9 | 8 |
| Physics | 6 | 10 | 9 |
| **Total** | **15** | **30** | **27** |

College A's actual performance is 27 publications.

Improvement achievement:

\[
\frac{27-15}{30-15}\times100=80\%
\]

Target achievement:

\[
\frac{27}{30}\times100=90\%
\]

The system displays:

- Baseline: 15.
- Target: 30.
- Actual: 27.
- Improvement achievement: 80%.
- Target achievement: 90%.

## 19.6 University-Level Performance

Assuming the three VP offices cover the university's complete, non-overlapping responsibility, the system aggregates their actual results.

The university's total actual publications are calculated by summing the verified results from the three offices.

The university then calculates its overall improvement and target achievement using its own baseline and target.

The system must not average the three VP offices' achievement percentages to obtain the university's overall achievement when the underlying KPI is an additive count.

---

# 20. Non-Functional Requirements

In addition to the functional requirements, the system should satisfy the following quality requirements.

## 20.1 Security

- Users must authenticate before accessing protected information.
- The system must enforce role-based and organizational-scope permissions.
- Sensitive operations must be authorized.
- Important changes must be audited.
- File uploads must be validated.
- Users must not access offices outside their permitted scope.

## 20.2 Performance

- Dashboards should load within acceptable response times.
- Aggregation calculations should support large organizational structures.
- Reporting queries should be optimized.
- Historical performance data should remain accessible without significantly slowing current reporting.

## 20.3 Reliability and Data Integrity

- Approved KPI assignments must be preserved.
- Performance calculations must be consistent.
- Changes must not cause duplicate aggregation.
- Important operations should be transactional.
- Historical records must remain traceable.

## 20.4 Usability

- Forms must adapt to the selected KPI measurement type.
- Calculated fields should be displayed automatically.
- Error messages must explain what needs to be corrected.
- Dashboards must clearly distinguish missing, pending, approved, and rejected data.
- Users should see only the actions appropriate to their permissions.

## 20.5 Maintainability

- KPI measurement methods should be configurable where possible.
- The organizational hierarchy must support changes.
- New KPI definitions should not require rebuilding the entire system.
- Calculation and aggregation rules should be centralized and consistently applied.

---

# 21. Final System Principles

The following principles are fundamental to the design and implementation of the AMU KPI Monitoring System.

1. **The university's organizational hierarchy determines how KPIs and responsibilities cascade.**

2. **The office assigning a KPI to a subordinate office establishes that subordinate office's official baseline and target.**

3. **Baseline, target, actual performance, and required improvement are separate pieces of information.**

4. **The system must support Number, Percentage, Ratio, Stage, Category, and Money measurement types.**

5. **Every KPI must define whether higher or lower performance values are better.**

6. **The system must calculate improvement achievement and assigned target achievement separately.**

7. **The system must use the correct aggregation method for each measurement type.**

8. **Percentage and ratio aggregation must use their underlying numerators and denominators.**

9. **Stage and category calculations must follow approved scoring and aggregation rules.**

10. **Parent responsibility must be reconciled with distributed and retained responsibility when the KPI's scope permits additive reconciliation.**

11. **The system must prevent double counting of subordinate contributions.**

12. **KPI importance weighting and responsibility allocation must remain separate.**

13. **Missing information must not silently be treated as zero.**

14. **Approved baselines, targets, assignments, and reports must be protected by an authorization and audit process.**

15. **University-level performance must be calculated from valid institutional results and approved aggregation rules, not by simply averaging office achievement percentages.**

16. **The university must be able to trace every reported performance result back to its responsible office, assigned KPI, reporting period, and supporting evidence.**

**The ultimate goal is to establish a transparent, measurable, and traceable performance management process in which institutional objectives are translated into office-level responsibilities, monitored through reliable data, and evaluated consistently across the entire university.**
