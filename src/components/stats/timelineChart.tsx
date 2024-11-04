"use client";

import { getLetterStats } from "@/lib/actions/stats";
import { useEffect, useRef } from "react";
import * as d3 from "d3";

export const TimelineChart = ({
  data,
}: {
  data: Awaited<ReturnType<typeof getLetterStats>>["timeLineStats"];
}) => {
  const ref = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  data = data.map((d) => ({
    ...d,
    day: new Date(d.day),
  }));

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";

    // set the dimensions and margins of the graph
    const margin = { top: 30, right: 30, bottom: 70, left: 60 },
      width = 860 - margin.left - margin.right,
      height = 400 - margin.top - margin.bottom;

    // append the svg object to the body of the page
    const svg = d3
      .select(ref.current)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X axis
    const x = d3
      .scaleTime()
      .domain(
        d3.extent(data, function (d) {
          return d.day;
        }) as [Date, Date]
      )
      .range([0, width]);
    svg
      .append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "translate(-10,0)rotate(-45)")
      .style("text-anchor", "end");

    console.log(data);
    console.log(d3.extent(data, (d) => d.current_items_count));

    // Add Y axis
    const y = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d.current_items_count) as [number, number])
      .range([height, 0]);
    svg.append("g").call(d3.axisLeft(y));

    // Bars
    svg
      .append("path")
      .datum(data)
      .on("mouseover", (e) => {
        tooltipRef.current!.innerText = "Abgeschlossene Briefe total";
        tooltipRef.current!.style.opacity = "1";
        tooltipRef.current!.style.top =
          d3.pointer(e, ref.current)[1] + 20 + "px";
        tooltipRef.current!.style.left =
          d3.pointer(e, ref.current)[0] + 20 + "px";
      })
      .on("mousemove", (e) => {
        tooltipRef.current!.style.top =
          d3.pointer(e, ref.current)[1] + 20 + "px";
        tooltipRef.current!.style.left =
          d3.pointer(e, ref.current)[0] + 20 + "px";
      })
      .on("mouseleave", (e) => {
        tooltipRef.current!.innerText = "";
        tooltipRef.current!.style.opacity = "0";
      })
      .attr("fill", "rgba(16,185,129,0.3)")
      .attr("stroke", "rgba(16,185,129,1)")
      .attr("stroke-width", 1.5)
      .attr(
        "d",
        d3
          .area<(typeof data)[number]>()
          .x((d) => x(d.day))
          .y0(y(0))
          .y1((d) => y(d.current_items_count))
      );

    svg
      .append("path")
      .datum(data)
      .on("mouseover", (e) => {
        tooltipRef.current!.innerText = "Abgeschlossene edierte Briefe";
        tooltipRef.current!.style.opacity = "1";
        tooltipRef.current!.style.top =
          d3.pointer(e, ref.current)[1] + 20 + "px";
        tooltipRef.current!.style.left =
          d3.pointer(e, ref.current)[0] + 20 + "px";
      })
      .on("mousemove", (e) => {
        tooltipRef.current!.style.top =
          d3.pointer(e, ref.current)[1] + 20 + "px";
        tooltipRef.current!.style.left =
          d3.pointer(e, ref.current)[0] + 20 + "px";
      })
      .on("mouseleave", (e) => {
        tooltipRef.current!.innerText = "";
        tooltipRef.current!.style.opacity = "0";
      })
      .attr("fill", "rgba(100,100,100,0.4)")
      .attr("stroke", "rgb(50,50,50)")
      .attr("stroke-width", 1.5)
      .attr(
        "d",
        d3
          .area<(typeof data)[number]>()
          .x((d) => x(d.day))
          .y0(y(0))
          .y1((d) => y(d.current_items_count_edited))
      );
  }, [data, ref]);

  return (
    <div className="relative">
      <svg
        className="mx-auto max-w-full"
        width={860}
        height={500}
        id="barchart"
        ref={ref}
      />
      <div
        className="opacity-0 absolute pointer-events-none bg-white shadow-xl p-2 border-gray-300 text-xs"
        ref={tooltipRef}
      ></div>
    </div>
  );
};
