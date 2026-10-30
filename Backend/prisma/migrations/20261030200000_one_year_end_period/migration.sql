-- At most one year-end period per fiscal year.
CREATE UNIQUE INDEX "reporting_period_one_year_end" ON "reporting_period"("fiscal_year_id") WHERE "is_year_end";
