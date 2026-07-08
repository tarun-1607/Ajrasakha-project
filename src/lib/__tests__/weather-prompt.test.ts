import { describe, it, expect } from "vitest";
import {
  buildWeatherAnswerRequirementsBlock,
  buildWeatherAnswerPrefix,
  buildWeatherPromptBlock,
  buildSprayAdvisoryBlock,
  isSprayQuestion,
  DEFAULT_WEATHER_SETTINGS,
  type WeatherResult,
} from "@/lib/weather.server";

function makeWeather(overrides: Partial<WeatherResult["snapshot"]["today"]> = {}): WeatherResult {
  return {
    snapshot: {
      latitude: 26.74,
      longitude: 83.89,
      timezone: "Asia/Kolkata",
      current: {
        temperatureC: 29,
        feelsLikeC: 36,
        humidity: 86,
        rainMm: 4.2,
        windSpeedKmh: 11,
        windDirectionDeg: 180,
        weatherCode: 3,
        condition: "Overcast",
        isDay: true,
        uvIndex: 5,
      },
      today: {
        tempMinC: 24,
        tempMaxC: 31,
        precipitationSumMm: 23.7,
        precipitationProbabilityMax: 88,
        windSpeedMaxKmh: 14,
        sunrise: "2026-07-07T05:12:00",
        sunset: "2026-07-07T18:47:00",
        uvIndexMax: 7,
        ...overrides,
      },
      hourly: Array.from({ length: 24 }).map((_, i) => ({
        time: `2026-07-07T${String(i).padStart(2, "0")}:00`,
        temperatureC: 27,
        precipitationProbability: 80,
        precipitationMm: 1,
        windSpeedKmh: 10,
      })),
      daily: [
        {
          date: "2026-07-07",
          tempMinC: 24,
          tempMaxC: 31,
          precipitationSumMm: 23.7,
          precipitationProbabilityMax: 88,
          windSpeedMaxKmh: 14,
          weatherCode: 3,
          condition: "Overcast",
          sunrise: "2026-07-07T05:12:00",
          sunset: "2026-07-07T18:47:00",
          uvIndexMax: 7,
        },
      ],
      fetchedAt: new Date().toISOString(),
    },
    location: {
      state: "Uttar Pradesh",
      district: "Kushinagar",
      block: null,
      latitude: 26.74,
      longitude: 83.89,
    },
    cached: true,
    stale: false,
    cacheAgeMinutes: 3,
  };
}

describe("weather prompt injection", () => {
  it("detects Hindi + English spray questions", () => {
    expect(isSprayQuestion("Kya aaj pesticide spray kar sakta hu?")).toBe(true);
    expect(isSprayQuestion("क्या मैं आज छिड़काव कर सकता हूँ?")).toBe(true);
    expect(isSprayQuestion("What is the MSP for wheat?")).toBe(false);
  });

  it("prompt block cites the exact cached weather values", () => {
    const w = makeWeather();
    const block = buildWeatherPromptBlock(w);
    expect(block).toContain("Kushinagar");
    expect(block).toContain("Uttar Pradesh");
    expect(block).toContain("29.0°C");
    expect(block).toContain("feels 36.0°C");
    expect(block).toContain("humidity 86%");
    expect(block).toContain("wind 11 km/h");
    expect(block).toContain("88%"); // rain probability
    expect(block).toContain("23.7 mm"); // rainfall
    expect(block).toContain("Overcast");
  });

  it("weather answer requirements force exact dashboard values into spray responses", () => {
    const w = makeWeather();
    const block = buildWeatherAnswerRequirementsBlock(w);
    expect(block).toContain("According to today's live weather in Kushinagar, Uttar Pradesh");
    expect(block).toContain("Temperature: 29°C");
    expect(block).toContain("Humidity: 86%");
    expect(block).toContain("Rain Probability: 88%");
    expect(block).toContain("Rainfall: 23.7 mm");
    expect(block).toContain("Wind Speed: 11 km/h");
    expect(block).toContain("Never say or imply 'check the weather forecast'");
  });

  it("weather answer prefix guarantees exact dashboard values appear in the AI response", () => {
    const w = makeWeather();
    const responsePrefix = buildWeatherAnswerPrefix(w);
    expect(responsePrefix).toContain("Temperature: 29°C");
    expect(responsePrefix).toContain("Humidity: 86%");
    expect(responsePrefix).toContain("Rain Probability: 88%");
    expect(responsePrefix).toContain("Rainfall: 23.7 mm");
    expect(responsePrefix).toContain("Wind Speed: 11 km/h");
  });

  it("spray advisory postpones when rain probability > threshold", () => {
    const w = makeWeather();
    const advisory = buildSprayAdvisoryBlock(w, DEFAULT_WEATHER_SETTINGS);
    expect(advisory.toLowerCase()).toContain("postponing");
    expect(advisory).toContain("88%");
  });

  it("spray advisory warns when wind exceeds threshold", () => {
    const w = makeWeather({ windSpeedMaxKmh: 30, precipitationProbabilityMax: 10 });
    const advisory = buildSprayAdvisoryBlock(w, DEFAULT_WEATHER_SETTINGS);
    expect(advisory.toLowerCase()).toContain("wind");
    expect(advisory).toContain("30 km/h");
  });

  it("spray advisory allows spraying in calm dry conditions", () => {
    const w = makeWeather({
      precipitationProbabilityMax: 10,
      precipitationSumMm: 0,
      windSpeedMaxKmh: 8,
    });
    const advisory = buildSprayAdvisoryBlock(w, DEFAULT_WEATHER_SETTINGS);
    expect(advisory.toLowerCase()).toContain("acceptable");
  });
});