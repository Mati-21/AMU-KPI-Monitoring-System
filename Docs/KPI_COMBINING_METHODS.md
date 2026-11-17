# Combining Offices and Combining Periods

A reference for the two "combining" choices on the Register KPI form. Every example uses plain numbers so you can check the arithmetic yourself.

- **Combining Offices** (`aggregationMethod`): how the results of the offices *below* an office add up into that office's result.
- **Combining Periods** (`periodRollupMethod`): how the results of *shorter periods* (months, quarters) make the result of a *longer* period (a half year, the year).

Both are set once per KPI, when the KPI is registered. They cannot change after the KPI is used on a contract.

Source of truth: `Backend/modules/07-performance-scoring/rules/aggregation.rules.js` (the formulas) and `Frontend/src/features/04-kpi-catalog/lib/kpiRules.js` (which options each measurement type offers).

---

## Contents

- **[Section 1: Which options each measurement type offers](#section-1-which-options-each-measurement-type-offers)**
- **[Section 2: Combining Offices](#section-2-combining-offices)**
  - [2.1 Sum](#21-sum)
  - [2.2 Ratio of sums](#22-ratio-of-sums)
  - [2.3 Weighted score](#23-weighted-score)
  - [2.4 Share meeting target](#24-share-meeting-target)
  - [2.5 Weakest link](#25-weakest-link)
  - [2.6 Stage distribution](#26-stage-distribution)
  - [2.7 Direct](#27-direct)
- **[Section 3: Adding an office's own work to its offices' work](#section-3-adding-an-offices-own-work-to-its-offices-work)**
- **[Section 4: Staff contracts](#section-4-staff-contracts)**
- **[Section 5: Combining Periods](#section-5-combining-periods)**
  - [5.1 Sum](#51-sum)
  - [5.2 Average](#52-average)
  - [5.3 Latest](#53-latest)
  - [5.4 Ratio of sums](#54-ratio-of-sums)
- **[Section 6: Stage and Category KPIs in detail](#section-6-stage-and-category-kpis-in-detail)**
  - [6.1 Two things to settle before combining](#61-two-things-to-settle-before-combining)
  - [6.2 Stage example, with every number](#62-stage-example-with-every-number)
  - [6.3 Category example, two-result scale (Yes/No)](#63-category-example-two-result-scale-yesno)
  - [6.4 Category example, ordered scale with scores](#64-category-example-ordered-scale-with-scores)
  - [6.5 Category example, unordered scale](#65-category-example-unordered-scale)
  - [6.6 Choosing for Stage and Category](#66-choosing-for-stage-and-category)
- **[Section 7: Special cases worth remembering](#section-7-special-cases-worth-remembering)**
- **[Section 8: Quick chooser](#section-8-quick-chooser)**

---

## Section 1: Which options each measurement type offers

The first option in each list is the form's default.

| Measurement type | Combining Offices | Combining Periods |
|---|---|---|
| **Number**, **Money** | Sum, Weighted score, Share meeting target, Direct | Sum, Latest, Average |
| **Percentage**, **Ratio** | Ratio of sums, Weighted score, Share meeting target, Direct | Ratio of sums, Latest |
| **Stage**, **Category** | Share meeting target, Stage distribution, Weakest link, Weighted score, Direct | Latest |

Two rules that follow from this:

- A percentage or ratio is **never averaged**. It always combines through its two parts (numerator and denominator). See [2.2](#22-ratio-of-sums) and [5.4](#54-ratio-of-sums).
- **Sum** needs the KPI to be additive. For Number and Money the form ticks "additive" for you.

[Back to contents](#contents)

---

## Section 2: Combining Offices

Example setting used below: a **Faculty** with three **Departments** (A, B, C). The Faculty's result is built from what the departments report.

Only offices that **have reported** are counted. An office with no result yet is left out, not counted as zero.

### 2.1 Sum
Adds the values of the offices.

| Department | Students trained |
|---|---|
| A | 120 |
| B | 80 |
| C | 100 |
| **Faculty** | **300** |

Use for: counts and amounts (students, publications, budget spent).

### 2.2 Ratio of sums
Adds all the numerators, adds all the denominators, then divides. Percentages are multiplied by 100.

| Department | Graduated | Enrolled | Rate |
|---|---|---|---|
| A | 40 | 50 | 80% |
| B | 30 | 100 | 30% |
| C | 90 | 100 | 90% |
| **Faculty** | **160** | **250** | **160 ÷ 250 = 64%** |

Averaging the three rates would give 66.7%, which is wrong: it treats a department of 50 students like one of 100. Ratio of sums weighs each department by its size.

If the total denominator is 0, there is **no result** (not 0%).

Use for: percentages and ratios, such as graduation rate or pass rate.

### 2.3 Weighted score
Does **not** combine measured values. It combines the departments' *target achievement* (how much of its own target each reached, capped by the system setting), weighted by each department's weight on its contract. The Faculty's result becomes a **score**, not a measured value.

| Department | Target achievement | Weight |
|---|---|---|
| A | 100% | 50 |
| B | 80% | 30 |
| C | 50% | 20 |

Score = (100×50 + 80×30 + 50×20) ÷ (50 + 30 + 20) = 8400 ÷ 100 = **84%**

Departments with no achievement yet are left out, and the division uses only the weights of those that count.

For Stage and Category KPIs the scale's scoring must be **approved**, or the KPI cannot be registered with this option. See Section 6.

Use for: when the parent should be judged by how well its offices did against their own targets, whatever the units.

### 2.4 Share meeting target
The percentage of reporting offices that met their target.

| Department | Target met? |
|---|---|
| A | Yes |
| B | Yes |
| C | No |

Score = 2 of 3 = **66.67%**

An office whose target status is not known counts as not met. Like Weighted score, the Faculty's result is a **score**.

Use for: "how many of our departments reached the standard" KPIs.

### 2.5 Weakest link
The parent is only as strong as its weakest office.

- **Higher is better**: the lowest value wins.
- **Lower is better**: the highest value wins.
- **Stage or Category**: the lowest level reached (by the scale's level order).

Examples:

| KPI | Offices | Faculty result |
|---|---|---|
| Lab safety score (higher is better) | 90, 75, 82 | **75** |
| Incident rate (lower is better) | 2, 5, 3 | **5** |
| Project stage (Planning < Building < Testing < Done) | Testing, Building, Done | **Building** |

With Weakest link the parent's own reported figure is ignored: the weakest office decides.

Use for: standards that must hold everywhere, such as safety or compliance.

### 2.6 Stage distribution
Counts **how many offices reached each level**. It is information shown beside the result. It is **not** turned into a number or a score.

| Level | Offices |
|---|---|
| Planning | 1 |
| Building | 2 |
| Testing | 0 |
| Done | 1 |

Use for: stage and category KPIs where you want to see the spread, not one figure.

### 2.7 Direct
No combining. The office reports its **own** figure and nothing is taken from the offices below.

Example: "University ranking", where the university reports one number and the colleges have no part in it.

[Back to contents](#contents)

---

## Section 3: Adding an office's own work to its offices' work

When an office both does work itself *and* has offices below it, the KPI's **scope relation** on the contract decides how the two meet. This only matters for results that are values (Sum, Ratio of sums, Weakest link). Weighted score and Share meeting target produce a score, which stands on its own.

| Scope relation | What the parent's result is |
|---|---|
| **Exclusive and complete** (the offices below cover separate, whole parts) | The parent's own figure **plus** the offices' combined figure. For Ratio of sums the parts are added before dividing. |
| **Overlapping** | The parent's own figure if it reported one, otherwise the offices' combined figure. Adding would count the same thing twice. |
| **Institution-wide** | Same as overlapping: the parent's own figure wins, otherwise the offices'. |

Example (Sum, exclusive and complete): the Faculty office itself trained 40 students, its departments trained 300. Faculty result = 40 + 300 = **340**.

Example (Sum, overlapping): the same figures give **40**, because the Faculty's own number is assumed to already include the departments. If it had reported nothing, the result would be 300.

Weakest link always uses the offices' result and ignores the parent's own figure.

[Back to contents](#contents)

---

## Section 4: Staff contracts

When an office gives a KPI to its own people on staff contracts, the office's own figure for it is made from their approved results. The method is picked from the KPI automatically:

| KPI | How staff results combine |
|---|---|
| Additive (counts, money) | Sum |
| Percentage or ratio | Ratio of sums |
| Anything else (stage, rating) | Weakest link |

Nothing is shown until at least one person's result is approved.

[Back to contents](#contents)

---

## Section 5: Combining Periods

Example setting used below: a KPI reported **quarterly**, with a **year-end** result.

Periods with **no result are skipped, never counted as zero.**

### 5.1 Sum
Adds the periods.

| Q1 | Q2 | Q3 | Q4 | Year |
|---|---|---|---|---|
| 10 | 15 | 12 | 18 | **55** |

If Q3 was not reported, the year is 10 + 15 + 18 = **43**, not 55 with a zero in it.

Use for: things that accumulate over the year (students trained, money spent).

### 5.2 Average
The sum of the reported periods divided by how many reported. Numbers and money only.

| Q1 | Q2 | Q3 | Q4 | Year |
|---|---|---|---|---|
| 30 | 40 | 35 | 35 | (30+40+35+35) ÷ 4 = **35** |

If Q2 was not reported: (30+35+35) ÷ 3 = **33.33**.

Use for: levels that go up and down, such as average class size.

### 5.3 Latest
Takes the **last reported period** as the year's result.

| Q1 | Q2 | Q3 | Q4 | Year |
|---|---|---|---|---|
| 900 | 950 | 1000 | (not reported) | **1000** (from Q3) |

Use for: a position at a moment in time, such as headcount at the end of a quarter. It is the only option for Stage and Category KPIs.

### 5.4 Ratio of sums
Adds the numerators and the denominators of every period, then divides.

| Period | Passed | Sat | Rate |
|---|---|---|---|
| Q1 | 40 | 50 | 80% |
| Q2 | 45 | 90 | 50% |
| Q3 | 18 | 20 | 90% |
| Q4 | 60 | 80 | 75% |
| **Year** | **163** | **240** | **163 ÷ 240 = 67.92%** |

Averaging the four quarterly rates would give 73.75%, which overstates the year because small quarters count as much as big ones.

Use for: percentages and ratios that should reflect the whole year's volume.

[Back to contents](#contents)

---

## Section 6: Stage and Category KPIs in detail

A Stage or Category KPI is measured on a **scale** (Measurement Setup, Scales) instead of a number. A result is a **level** of that scale, so there is nothing to add or average. That is why these KPIs have their own combining options.

| | Stage scale | Category scale |
|---|---|---|
| What the levels are | Steps in order, each with written criteria for "how to tell this stage is reached" | Named results |
| Order | Always ordered, never two-result | Ordered, unordered, or two-result (Yes/No) |
| Numeric scores | Possible | Possible only if ordered and not two-result |

The system compares levels by their **order in the scale's list**, worst first. List the levels from worst to best. For a lower-is-better KPI the comparison is reversed.

### 6.1 Two things to settle before combining

**Are the scale's scores approved?** (Measurement Setup, Scales, the tick icon.) This changes what each office's result becomes:

| | Scores approved | Scores not approved |
|---|---|---|
| Result of one office | A percentage: reached score ÷ target score | Only "target met" or "below target". A two-result scale counts as 100 or 0 |
| Weighted score (combining) | Allowed | **Refused when the KPI is registered** |
| Improvement scoring | Allowed | **Refused when the KPI is registered** |

**Does each office have its own target?** Yes. Each department's contract sets its own target level, and "target met" is judged against that department's own target, not the Faculty's.

### 6.2 Stage example, with every number

Scale "Project Stage", scores approved: **Planning 25, Building 50, Testing 75, Done 100**.
The Faculty gives the KPI to three departments, each with the target **Testing (75)**, and weights 50, 30 and 20. The year-end reports are in.

| Department | Level reached | Score | Achievement (score ÷ 75) | Target met? | Weight |
|---|---|---|---|---|---|
| A | Testing | 75 | 100% | Yes | 50 |
| B | Building | 50 | 66.67% | No | 30 |
| C | Done | 100 | 133.33%, counted as 100% when the cap is at 100% | Yes | 20 |

What the **Faculty** gets under each Combining Offices option:

| Option | Faculty result | How |
|---|---|---|
| **Share meeting target** | **66.67%** (a score) | 2 of 3 departments met their target |
| **Weakest link** | **Building** (a level) | The lowest level reached. The Faculty's own target is Testing, so its achievement is 50 ÷ 75 = **66.67%**, below target |
| **Stage distribution** | **1 at Building, 1 at Testing, 1 at Done** | Counts only. The Faculty gets **no** level or score from this. It has a result only if its own office reports its own level |
| **Weighted score** | **90%** (a score) | (100×50 + 66.67×30 + 100×20) ÷ (50+30+20) = 9000 ÷ 100 = 90. Without the 100% cap, C counts as 133.33 and the score is 106.67% |
| **Direct** | The Faculty's own level | Nothing is taken from the departments |

**The same example when scores are not approved:** Weighted score cannot be chosen. The others still work, because they only compare levels. Share meeting target is still 66.67%. Weakest link is still Building, but the Faculty only shows "below target", with no 66.67%. Stage distribution is unchanged.

**When departments have different targets:** A targets Testing, B targets Building, C targets Done. The levels reached are the same as above, except C reached Testing.

| Department | Reached | Own target | Met? |
|---|---|---|---|
| A | Testing | Testing | Yes |
| B | Building | Building | Yes |
| C | Testing | Done | No |

- Share meeting target = 2 of 3 = **66.67%**.
- Weakest link = **Building**, even though B met its own target. Weakest link looks at the level reached and ignores each department's target.

**Across the year** a Stage KPI can only use **Latest**. Quarterly levels Planning, Building, Building, Testing give a year-end level of **Testing**. If Q4 had been Building after Q3 Testing, the year-end would be **Building**: it is the latest report, not the best one.

**Improvement scoring** (the other scoring method) measures the move from the baseline. Baseline Planning (25), target Testing (75), required improvement 50. Reaching Building (50) is an improvement of 25, so **25 ÷ 50 = 50%**. This needs approved scores and a known, verified baseline.

### 6.3 Category example, two-result scale (Yes/No)

Scale "Curriculum approved", a two-result category with levels **No (first), Yes (second)**. Scores can never be approved for a two-result scale. The target for every department is **Yes**.

| Department | Reached | Target met? | Own result |
|---|---|---|---|
| A | Yes | Yes | 100 |
| B | No | No | 0 |
| C | Yes | Yes | 100 |

| Option | Faculty result |
|---|---|
| **Share meeting target** | **66.67%** (2 of 3) |
| **Weakest link** | **No**: one department without it means the Faculty does not have it everywhere |
| **Stage distribution** | **Yes: 2, No: 1** (information only) |
| **Weighted score** | **Not available**, because a two-result scale cannot have approved scores |
| **Direct** | The Faculty's own answer |

A two-result scale gives each office **100 or 0**, even without approved scores.

### 6.4 Category example, ordered scale with scores

Scale "Service rating", ordered and scored: **Poor 25, Fair 50, Good 75, Excellent 100**. Target for every department is **Good (75)**, weights 50, 30, 20.

| Department | Reached | Achievement (score ÷ 75) | Counted (cap at 100%) |
|---|---|---|---|
| A | Excellent | 133.33% | 100% |
| B | Fair | 66.67% | 66.67% |
| C | Good | 100% | 100% |

- **Share meeting target:** A and C met it, B did not. **66.67%**.
- **Weakest link:** the lowest rating is **Fair**.
- **Stage distribution:** Excellent 1, Good 1, Fair 1, Poor 0.
- **Weighted score:** (100×50 + 66.67×30 + 100×20) ÷ 100 = **90%**.

### 6.5 Category example, unordered scale

Scale "Research focus" with the levels Teaching, Research, Service, which have **no better or worse order**. This is the case to be careful with, because the system still compares levels by their list position.

- **Share meeting target** and **Weakest link** would treat the first listed level as the lowest. That is meaningless for an unordered list.
- **Stage distribution** is the honest choice here: it counts how many offices chose each category and makes no claim about which is better. Teaching 2, Research 1, Service 0.
- **Direct** also works, when the parent reports one answer itself.

If the results do have a better and a worse, make the scale **ordered** and list the levels worst to best.

### 6.6 Choosing for Stage and Category

| Question the Faculty must answer | Option |
|---|---|
| How many of our departments reached their targets? | Share meeting target (the default) |
| Is every department at least at a level? | Weakest link |
| Where are our departments spread across the stages? | Stage distribution |
| How well did departments do against targets, with some counting more? | Weighted score (needs approved scores) |
| The parent reports it itself | Direct |

[Back to contents](#contents)

---

## Section 7: Special cases worth remembering

- **Running total during the year.** For an additive KPI the annual target is judged on the earlier approved periods plus the current one. Improvement is only measured at year end, because a running total is not a final result.
- **Score KPIs** (Weighted score, Share meeting target): each period already holds a **score**, not a measured value. A longer period takes the **latest score as it is**. Scores are never added or averaged as if they were results.
- **Missing data.** Missing offices and missing periods are skipped. The result is marked incomplete until every expected office or period has reported.
- **Percentages, ratios and money** are never mixed across currencies or averaged. Money is compared in the reporting currency.

[Back to contents](#contents)

---

## Section 8: Quick chooser

| You want to measure... | Combining Offices | Combining Periods |
|---|---|---|
| A count or amount that adds up (students, publications, spending) | Sum | Sum |
| A level that moves up and down (class size) | Sum or Direct | Average |
| A position at a point in time (headcount, assets) | Sum | Latest |
| A percentage (graduation, pass rate) | Ratio of sums | Ratio of sums |
| A standard every office must meet (safety) | Weakest link | Latest |
| How well offices did against their own targets | Weighted score | Latest |
| How many offices reached the standard | Share meeting target | Latest |
| The spread of offices across stages | Stage distribution | Latest |
| One figure the parent reports itself | Direct | match the KPI type |

[Back to contents](#contents)
