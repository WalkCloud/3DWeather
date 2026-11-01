import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SunIcon,
  CloudIcon,
  CloudRainIcon,
  CloudLightningIcon,
  SnowflakeIcon,
  CloudFogIcon,
  WindIcon,
  MoonStarsIcon,
  MapPinIcon,
  MagnifyingGlassIcon,
  ArrowClockwiseIcon,
  ArrowsClockwiseIcon,
  PlayIcon,
  PauseIcon,
  XIcon,
  CaretDownIcon,
  ClockIcon,
  CubeIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
} from "@phosphor-icons/react";
import { createWeatherWorld } from "./world.js";
import {
  CITIES,
  WEATHER,
  accumulateSnow,
  clearSnow,
  demoWeather,
  normalizeWeather,
  readSnow,
  seasonFor,
  dayPhaseFor,
} from "./weather.js";
import { LANGUAGES, readLanguage, saveLanguage } from "./i18n.js";
import { isRainCondition } from "./rain.js";

const ICONS = {
  sunny: SunIcon,
  cloudy: CloudIcon,
  rain: CloudRainIcon,
  moderateRain: CloudRainIcon,
  heavyRain: CloudRainIcon,
  storm: CloudLightningIcon,
  snow: SnowflakeIcon,
  fog: CloudFogIcon,
  windy: WindIcon,
  night: MoonStarsIcon,
};
export function WeatherIcon({ condition, ...props }) {
  const Icon = ICONS[condition] || SunIcon;
  return <Icon weight="duotone" {...props} />;
}

function WeatherScene({
  weather,
  snow,
  environment,
  autoRotate,
  apiRef,
  onStatus,
  retry,
  sceneLabel,
  canvasLabel,
  soundEnabled,
}) {
  const host = useRef(null);
  const current = useRef({
    weather,
    snow,
    environment,
    autoRotate,
    soundEnabled,
  });
  current.current = { weather, snow, environment, autoRotate, soundEnabled };
  useEffect(() => {
    let world;
    try {
      world = createWeatherWorld(host.current, onStatus);
      apiRef.current = world;
      world.setWeather(
        current.current.weather,
        current.current.snow,
        current.current.environment.season,
      );
      world.setEnvironment(current.current.environment);
      world.setAutoRotate(current.current.autoRotate);
      world.setSoundEnabled(current.current.soundEnabled);
    } catch (error) {
      onStatus({ error: error.message, ready: false });
    }
    return () => {
      world?.dispose();
      apiRef.current = null;
    };
  }, [apiRef, onStatus, retry]);
  useEffect(() => {
    apiRef.current?.setWeather(weather, snow, environment.season);
  }, [weather, snow, environment.season, apiRef]);
  useEffect(() => {
    apiRef.current?.setEnvironment(environment);
    host.current?.setAttribute("aria-label", sceneLabel);
    host.current
      ?.querySelector("canvas")
      ?.setAttribute("aria-label", canvasLabel);
  }, [environment, sceneLabel, canvasLabel]);
  useEffect(() => {
    apiRef.current?.setAutoRotate(autoRotate);
  }, [autoRotate, apiRef]);
  useEffect(() => {
    apiRef.current?.setSoundEnabled(soundEnabled);
  }, [soundEnabled, apiRef]);
  return (
    <div
      ref={host}
      className="world"
      data-testid="weather-world"
      aria-label="可左右拖动、360度旋转的3D微缩牧场"
    />
  );
}

function Gauge({ label, value, unit, min = 0, max, color, display }) {
  const fraction = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return (
    <div
      className="gauge"
      style={{ "--gauge-color": color, "--level": `${fraction * 100}%` }}
    >
      <span className="gauge-label">{label}</span>
      <span className="gauge-value">{display ?? value}</span>
      <span className="gauge-unit">{unit}</span>
      <div
        className="gauge-track"
        role="meter"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${display ?? value} ${unit}`}
      >
        <div className="gauge-ticks" aria-hidden="true">
          {Array.from({ length: 21 }, (_, i) => (
            <i key={i} className={i % 5 === 0 ? "major" : ""} />
          ))}
        </div>
        <div className="gauge-fill" />
        <div className="gauge-dot" />
      </div>
    </div>
  );
}

const SEASON_TEMPERATURES = {
  spring: {
    sunny: 23,
    cloudy: 20,
    rain: 17,
    moderateRain: 16,
    heavyRain: 15,
    storm: 16,
    snow: 2,
    fog: 15,
    windy: 21,
    night: 14,
  },
  summer: {
    sunny: 31,
    cloudy: 28,
    rain: 26,
    moderateRain: 25,
    heavyRain: 24,
    storm: 25,
    snow: 8,
    fog: 23,
    windy: 29,
    night: 25,
  },
  autumn: {
    sunny: 21,
    cloudy: 18,
    rain: 15,
    moderateRain: 14,
    heavyRain: 13,
    storm: 14,
    snow: 0,
    fog: 13,
    windy: 19,
    night: 12,
  },
  winter: {
    sunny: 5,
    cloudy: 1,
    rain: 3,
    moderateRain: 2,
    heavyRain: 1,
    storm: 2,
    snow: -4,
    fog: 0,
    windy: 2,
    night: -3,
  },
};

function demoForSeason(condition, city, season) {
  const base = demoWeather(condition, city);
  const temperature = SEASON_TEMPERATURES[season][condition];
  return {
    ...base,
    temperature,
    feelsLike:
      temperature +
      (condition === "windy" ? -3 : isRainCondition(condition) ? -2 : 1),
  };
}

export function App() {
  const [language, setLanguage] = useState(readLanguage);
  const [now, setNow] = useState(() => new Date());
  const [observation, setObservation] = useState(() => {
    const previewCondition = new URLSearchParams(window.location.search).get(
      "condition",
    );
    return demoForSeason(
      Object.hasOwn(WEATHER, previewCondition) ? previewCondition : "sunny",
      "杭州",
      seasonFor(new Date()),
    );
  });
  const [day, setDay] = useState(0);
  const [snow, setSnow] = useState(() => readSnow("杭州"));
  const [autoRotate, setAutoRotate] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState({ progress: 0, ready: false });
  const [retry, setRetry] = useState(0);
  const [environmentOverride, setEnvironmentOverride] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const season = params.get("season");
    const phase = params.get("phase");
    const hourParameter = params.get("hour");
    const hour = hourParameter === null ? NaN : Number(hourParameter);
    const override = {};
    if (["spring", "summer", "autumn", "winter"].includes(season))
      override.season = season;
    if (["dawn", "day", "dusk", "night"].includes(phase))
      override.phase = phase;
    if (Number.isFinite(hour) && hour >= 0 && hour <= 24) override.hour = hour;
    return Object.keys(override).length ? override : null;
  });
  const apiRef = useRef(null);
  const searchRef = useRef(null);
  const cityInput = useRef(null);
  const weatherMenuRef = useRef(null);
  const handleStatus = useCallback(
    (next) => setStatus((previous) => ({ ...previous, ...next })),
    [],
  );
  const forecasts = useMemo(() => {
    const snowy =
      observation.condition === "snow" || readSnow(observation.city) > 0.1;
    const season = seasonFor(now);
    const tomorrowTemperature = snowy
      ? SEASON_TEMPERATURES[season].sunny
      : SEASON_TEMPERATURES[season].cloudy;
    const afterTemperature = snowy
      ? SEASON_TEMPERATURES[season].cloudy
      : SEASON_TEMPERATURES[season].rain;
    return [
      {
        day: "今天",
        condition: observation.condition,
        temperature: observation.temperature,
      },
      {
        day: "明天",
        condition: snowy ? "sunny" : "cloudy",
        temperature: tomorrowTemperature,
      },
      {
        day: "后天",
        condition: snowy ? "cloudy" : season === "winter" ? "snow" : "rain",
        temperature: afterTemperature,
      },
    ];
  }, [observation, now]);
  const dictionary = LANGUAGES[language];
  const T = dictionary.ui;
  const season = seasonFor(now);
  const phase = dayPhaseFor(now);
  const groundSnow = season === "winter" ? Math.max(snow, 0.34) : snow;
  const environment = useMemo(
    () => ({
      season: environmentOverride?.season ?? season,
      phase: environmentOverride?.phase ?? phase,
      hour: environmentOverride?.hour ?? now.getHours() + now.getMinutes() / 60,
    }),
    [season, phase, now, environmentOverride],
  );
  const localTime = useMemo(
    () =>
      new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(now),
    [language, now],
  );
  const weather = useMemo(
    () =>
      day === 0
        ? observation
        : {
            ...demoForSeason(
              forecasts[day].condition,
              observation.city,
              season,
            ),
            temperature: forecasts[day].temperature,
            feelsLike: forecasts[day].temperature - 1,
          },
    [observation, day, forecasts],
  );
  useEffect(() => {
    const update = () =>
      setSnow(
        Math.max(
          readSnow(observation.city, Date.now() + day * 86400000),
          weather.condition === "snow" ? 0.94 : 0,
        ),
      );
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [day, observation.city, weather.condition]);
  useEffect(() => {
    const close = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target))
        setSearchOpen(false);
      if (
        weatherMenuRef.current &&
        !weatherMenuRef.current.contains(event.target)
      )
        setWeatherOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setWeatherOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  useEffect(() => {
    if (searchOpen) cityInput.current?.focus();
  }, [searchOpen]);
  useEffect(() => {
    const bridge = {
      update(snapshot) {
        const next = normalizeWeather(snapshot);
        if (next.condition === "snow") accumulateSnow(next.city);
        setObservation(next);
        setDay(0);
      },
      resetView() {
        apiRef.current?.reset();
      },
      setEnvironment(next = {}) {
        setEnvironmentOverride((previous) => ({ ...previous, ...next }));
      },
    };
    window.PocketWeather = bridge;
    return () => {
      if (window.PocketWeather === bridge) delete window.PocketWeather;
    };
  }, []);
  const chooseWeather = (condition) => {
    if (condition === "snow") setSnow(accumulateSnow(observation.city));
    setObservation(demoForSeason(condition, observation.city, season));
    setDay(0);
    setWeatherOpen(false);
  };
  const chooseCity = (city) => {
    setObservation(demoForSeason(observation.condition, city, season));
    setQuery("");
    setSearchOpen(false);
    setDay(0);
  };
  const normalizedQuery = query.trim().toLowerCase();
  const matchingCities = CITIES.filter(
    (city) =>
      city.includes(query.trim()) ||
      (LANGUAGES.en.cities[city] ?? city)
        .toLowerCase()
        .includes(normalizedQuery),
  );
  const isNight =
    weather.condition === "night" || environment.phase === "night";
  const displayedCondition =
    isNight && weather.condition === "sunny" ? "night" : weather.condition;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.title =
      language === "zh" ? "小牧场 · 3D天气" : "Little Pasture · 3D Weather";
  }, [language]);

  return (
    <main
      className={`weather-app ${isNight ? "is-night" : ""}`}
      data-weather={weather.condition}
      data-snow={groundSnow.toFixed(2)}
      data-season={season}
      data-phase={phase}
    >
      <WeatherScene
        weather={weather}
        snow={groundSnow}
        environment={environment}
        autoRotate={autoRotate}
        soundEnabled={soundEnabled}
        apiRef={apiRef}
        onStatus={handleStatus}
        retry={retry}
        sceneLabel={T.sceneLabel}
        canvasLabel={T.canvasLabel}
      />
      <section
        className="weather-card glass"
        aria-label={T.weather}
        ref={searchRef}
      >
        <header className="card-header">
          <button
            className="location"
            onClick={() => setSearchOpen((value) => !value)}
            aria-expanded={searchOpen}
            aria-controls="city-search"
          >
            <MapPinIcon weight="fill" size={21} />
            {dictionary.cities[observation.city] ?? observation.city}
            <CaretDownIcon className="location-caret" size={12} />
          </button>
          <button
            className="language-button"
            onClick={() => {
              const next = language === "zh" ? "en" : "zh";
              setLanguage(next);
              saveLanguage(next);
            }}
            aria-label={language === "zh" ? "Switch to English" : "切换到中文"}
          >
            {dictionary.switchLabel}
          </button>
          <button
            className="icon-button search-button"
            onClick={() => setSearchOpen((value) => !value)}
            aria-label={T.searchCity}
          >
            <MagnifyingGlassIcon size={23} weight="light" />
          </button>
        </header>
        <div className="local-clock" aria-label={T.localTime}>
          <ClockIcon size={15} weight="light" />
          <time dateTime={now.toISOString()}>{localTime}</time>
          <span>·</span>
          <strong>{dictionary.seasons[season]}</strong>
          <span>·</span>
          <strong>{dictionary.phases[phase]}</strong>
        </div>
        <div className="current-weather">
          <div className="temperature">
            {String(weather.temperature).replace("-", "−")}
            <span>°</span>
          </div>
          <div className={`weather-symbol symbol-${displayedCondition}`}>
            <WeatherIcon condition={displayedCondition} size={56} />
            <span>{dictionary.weather[displayedCondition].label}</span>
          </div>
        </div>
        <p className="feels-like">
          {T.feelsLike} {String(weather.feelsLike).replace("-", "−")}°
          <span>·</span>
          {dictionary.directions[weather.direction] ?? weather.direction}
        </p>
        <div className="card-divider" />
        <p className="weather-message">
          {groundSnow > 0.15 && weather.condition !== "snow"
            ? T.yesterdaySnow
            : dictionary.weather[displayedCondition].message}
        </p>
        {groundSnow > 0.05 && (
          <p className="snow-note">
            <SnowflakeIcon size={13} />
            {T.snowAbout} {Math.max(1, Math.round(groundSnow * 7))} cm
            <span>·</span>
            {weather.condition === "snow" ? T.accumulating : T.melting}
          </p>
        )}
        <p className="data-note">
          {day > 0
            ? `${day === 1 ? T.tomorrow : T.afterTomorrow} ${T.forecastNote} · `
            : ""}
          {weather.source === "api" ? T.apiData : T.demoData}
        </p>
        {searchOpen && (
          <div
            className="city-search glass"
            id="city-search"
            role="dialog"
            aria-label={T.switchCity}
          >
            <div className="city-input">
              <MagnifyingGlassIcon size={18} />
              <input
                ref={cityInput}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && matchingCities[0])
                    chooseCity(matchingCities[0]);
                }}
                placeholder={T.searchCity}
                aria-label={T.city}
              />
              <button
                className="icon-button"
                onClick={() => setSearchOpen(false)}
                aria-label={T.closeCitySearch}
              >
                <XIcon size={16} />
              </button>
            </div>
            <p>{T.demoCities}</p>
            <div className="city-options">
              {matchingCities.map((city) => (
                <button
                  key={city}
                  onClick={() => chooseCity(city)}
                  className={city === observation.city ? "selected" : ""}
                >
                  {dictionary.cities[city] ?? city}
                </button>
              ))}
            </div>
            {!matchingCities.length && (
              <p className="empty-state">{T.noCity}</p>
            )}
          </div>
        )}
      </section>
      <aside className="instruments glass" aria-label={T.weather}>
        <Gauge
          label={T.wind}
          value={weather.wind}
          display={weather.wind.toFixed(1)}
          unit="m/s"
          max={15}
          color="#83e9d3"
        />
        <Gauge
          label={T.temperature}
          value={weather.temperature}
          display={String(weather.temperature).replace("-", "−")}
          unit="°C"
          min={-10}
          max={40}
          color="#ffd487"
        />
        <Gauge
          label={T.humidity}
          value={weather.humidity}
          unit="%"
          max={100}
          color="#81e8fc"
        />
        <Gauge
          label={T.uv}
          value={weather.uv}
          unit="UV"
          max={11}
          color="#ffb4ae"
        />
      </aside>
      <div className="bottom-center">
        <nav className="forecast glass" aria-label={T.forecast}>
          {forecasts.map((forecast, index) => (
            <button
              key={forecast.day}
              onClick={() => setDay(index)}
              className={`forecast-day ${day === index ? "active" : ""}`}
              aria-pressed={day === index}
            >
              <WeatherIcon
                condition={forecast.condition}
                className={`forecast-${forecast.condition}`}
                size={31}
              />
              <span>
                {index === 0
                  ? T.today
                  : index === 1
                    ? T.tomorrow
                    : T.afterTomorrow}
              </span>
              <span className="forecast-label">
                {dictionary.weather[forecast.condition].label}
              </span>
              <strong>{String(forecast.temperature).replace("-", "−")}°</strong>
              {index === 1 && groundSnow > 0.1 && (
                <span className="forecast-snow" title={T.snowTomorrow}>
                  <SnowflakeIcon size={13} />
                </span>
              )}
            </button>
          ))}
        </nav>
        <p className="orbit-hint">
          <ArrowsClockwiseIcon size={24} weight="light" />
          <span>
            {T.dragHint}
            <span className="hint-dot">·</span>
            {T.orbitHint}
          </span>
        </p>
      </div>
      <div className="bottom-left" ref={weatherMenuRef}>
        <button
          className="weather-preview"
          aria-expanded={weatherOpen}
          aria-controls="weather-menu"
          onClick={() => setWeatherOpen((value) => !value)}
        >
          <WeatherIcon
            condition={isNight ? "night" : "sunny"}
            size={25}
            weight="light"
          />
          <span>{dictionary.phases[isNight ? "night" : "day"]}</span>
          <span className="preview-separator" />
          <span className="preview-label">{T.weatherPreview}</span>
          <CaretDownIcon size={12} />
        </button>
        {weatherOpen && (
          <div
            className="weather-menu glass"
            id="weather-menu"
            role="dialog"
            aria-label={T.weatherPreview}
          >
            <div className="menu-heading">
              <span>{T.chooseWeather}</span>
              <button
                className="icon-button"
                onClick={() => setWeatherOpen(false)}
                aria-label={T.closeWeatherMenu}
              >
                <XIcon size={16} />
              </button>
            </div>
            <div className="weather-options">
              {Object.entries(WEATHER).map(([key, value]) => (
                <button
                  key={key}
                  data-condition={key}
                  onClick={() => chooseWeather(key)}
                  className={observation.condition === key ? "selected" : ""}
                  aria-pressed={observation.condition === key}
                >
                  <WeatherIcon condition={key} size={25} />
                  <span>{dictionary.weather[key].label}</span>
                </button>
              ))}
            </div>
            {weather.condition === "storm" && (
              <div className="storm-controls">
                <button
                  aria-pressed={soundEnabled}
                  onClick={() => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    apiRef.current?.setSoundEnabled(next);
                  }}
                >
                  {soundEnabled ? (
                    <SpeakerHighIcon size={17} />
                  ) : (
                    <SpeakerSlashIcon size={17} />
                  )}
                  <span>{soundEnabled ? T.thunderOn : T.thunderOff}</span>
                </button>
                <button
                  onClick={() => {
                    apiRef.current?.flashLightning();
                    setWeatherOpen(false);
                  }}
                >
                  <CloudLightningIcon size={17} />
                  <span>{T.previewLightning}</span>
                </button>
              </div>
            )}
            {groundSnow > 0.05 && (
              <button
                className="melt-snow"
                onClick={() => {
                  clearSnow(observation.city);
                  setSnow(0);
                  setObservation(
                    demoForSeason("sunny", observation.city, season),
                  );
                  setDay(0);
                  setWeatherOpen(false);
                }}
              >
                {T.meltSnow}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="scene-controls">
        <button
          className={`round-control ${autoRotate ? "active" : ""}`}
          onClick={() => setAutoRotate((value) => !value)}
          title={autoRotate ? T.pauseOrbit : T.autoOrbit}
          aria-label={autoRotate ? T.pauseOrbit : T.autoOrbit}
          aria-pressed={autoRotate}
        >
          {autoRotate ? <PauseIcon size={19} /> : <PlayIcon size={19} />}
        </button>
        <button
          className="round-control"
          onClick={() => {
            apiRef.current?.reset();
            setAutoRotate(false);
          }}
          aria-label={T.resetView}
          title={T.resetView}
        >
          <ArrowClockwiseIcon size={20} />
        </button>
      </div>
      {!status.ready && (
        <div className="loading-scene" role="status" aria-live="polite">
          <div className="loading-content glass">
            {status.error ? (
              <>
                <CubeIcon size={28} weight="light" />
                <p>{T.loadFailed}</p>
                <button
                  className="retry-button"
                  onClick={() => {
                    setStatus({ ready: false, progress: 0 });
                    setRetry((value) => value + 1);
                  }}
                >
                  {T.retry}
                </button>
                <details>
                  <summary>{T.reason}</summary>
                  {status.error}
                </details>
              </>
            ) : (
              <>
                <CubeIcon size={30} weight="light" className="loading-cube" />
                <p>{T.loading}</p>
                <div className="loading-track">
                  <span
                    style={{
                      width: `${Math.round((status.progress || 0) * 100)}%`,
                    }}
                  />
                </div>
                <small>{Math.round((status.progress || 0) * 100)}%</small>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
