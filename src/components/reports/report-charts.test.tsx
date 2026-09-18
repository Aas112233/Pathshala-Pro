import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PieChart } from "./report-charts";
import en from "@/messages/en.json";
import ur from "@/messages/ur.json";
import hi from "@/messages/hi.json";
import bn from "@/messages/bn.json";

afterEach(cleanup);

function chart(values: number[], locale = "en", messages = en) {
  const onError = vi.fn();
  const result = render(
    <NextIntlClientProvider locale={locale} messages={messages} onError={onError}>
      <PieChart title={messages.reports.feeReport.paymentMethodBreakdown}
        data={values.map((value, index) => ({
          label: index === 0 ? messages.reports.feeReport.cash : messages.reports.feeReport.digital,
          value,
        }))} />
    </NextIntlClientProvider>
  );
  expect(onError).not.toHaveBeenCalled();
  return result;
}

describe("Fee report donut", () => {
  it.each([["en", en], ["ur", ur], ["hi", hi], ["bn", bn]] as const)(
    "renders real translated labels in %s", (locale, messages) => {
      chart([75, 25], locale, messages);
      expect(screen.getByText(messages.reports.charts.total)).toBeDefined();
      expect(screen.getByText(messages.reports.feeReport.cash)).toBeDefined();
      expect(screen.getByText(messages.reports.feeReport.digital)).toBeDefined();
    }
  );

  it("renders a complete circle for a single nonzero category", () => {
    const { container } = chart([100, 0]);
    expect(container.querySelectorAll('circle[fill="var(--chart-1)"]')).toHaveLength(1);
  });

  it("does not turn a nearly full category into a full circle", () => {
    const { container } = chart([9999, 1]);
    expect(container.querySelectorAll('circle[fill="var(--chart-1)"]')).toHaveLength(0);
    expect(container.querySelectorAll("path")).toHaveLength(2);
  });

  it("shows an empty state for all-zero values", () => {
    chart([0, 0]);
    expect(screen.getByText(en.reports.common.noData)).toBeDefined();
  });
});
