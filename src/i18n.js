export const LANGUAGES = {
  zh: {
    name: "中文",
    switchLabel: "EN",
    weather: {
      sunny: { label: "晴", message: "微风吹过小牧场" },
      cloudy: { label: "阴", message: "云朵慢慢走，日子慢慢过" },
      rain: { label: "小雨", message: "听，雨落在小屋旁" },
      moderateRain: { label: "中雨", message: "雨声渐密，草木静静喝水" },
      heavyRain: { label: "大雨", message: "雨幕落下，小屋守着暖光" },
      storm: { label: "雷阵雨", message: "雨声里的小屋，依然暖暖的" },
      snow: { label: "小雪", message: "雪慢慢落，小屋暖暖的" },
      fog: { label: "薄雾", message: "山间的雾，把清晨放慢" },
      windy: { label: "有风", message: "风经过草地，带来一点自由" },
      night: { label: "晴夜", message: "星光亮了，小屋也亮了" },
    },
    directions: {
      东南风: "东南风",
      东风: "东风",
      东北风: "东北风",
      北风: "北风",
      西北风: "西北风",
    },
    cities: {
      杭州: "杭州",
      上海: "上海",
      北京: "北京",
      成都: "成都",
      苏州: "苏州",
      大理: "大理",
    },
    seasons: { spring: "春", summer: "夏", autumn: "秋", winter: "冬" },
    phases: { dawn: "清晨", day: "白天", dusk: "黄昏", night: "夜间" },
    ui: {
      weather: "天气情况",
      searchCity: "搜索城市",
      city: "城市名称",
      demoCities: "演示城市",
      noCity: "没有匹配的演示城市",
      closeCitySearch: "关闭城市搜索",
      switchCity: "切换城市",
      feelsLike: "体感",
      yesterdaySnow: "昨日的雪，还留在草地上",
      snowAbout: "积雪约",
      accumulating: "正在积雪",
      melting: "缓慢消融",
      forecastNote: "预报",
      apiData: "天气数据",
      demoData: "演示数据",
      localTime: "本地时间",
      wind: "风速",
      temperature: "温度",
      humidity: "湿度",
      uv: "紫外线",
      forecast: "三日天气预报",
      today: "今天",
      tomorrow: "明天",
      afterTomorrow: "后天",
      snowTomorrow: "明天仍保留积雪",
      dragHint: "左右拖动",
      orbitHint: "360° 环绕",
      weatherPreview: "天气预览",
      chooseWeather: "换一种天气，看看小牧场",
      closeWeatherMenu: "关闭天气菜单",
      meltSnow: "融化积雪",
      thunderOn: "雷声：开",
      thunderOff: "雷声：关",
      previewLightning: "闪电演示",
      autoOrbit: "自动环绕",
      pauseOrbit: "暂停自动环绕",
      resetView: "恢复初始视角",
      loading: "正在唤醒小牧场",
      retry: "重新载入",
      loadFailed: "小牧场暂时没有载入成功",
      reason: "查看原因",
      sceneLabel: "可左右拖动、360度旋转的3D微缩牧场",
      canvasLabel:
        "3D微缩牧场：左右拖动环绕，滚轮缩放，方向键调整视角，R键复位",
    },
  },
  en: {
    name: "English",
    switchLabel: "中文",
    weather: {
      sunny: { label: "Sunny", message: "A light breeze crosses the meadow" },
      cloudy: {
        label: "Overcast",
        message: "Clouds drift; the day takes its time",
      },
      rain: { label: "Light Rain", message: "Rain taps softly by the cottage" },
      moderateRain: {
        label: "Moderate Rain",
        message: "Steady rain settles over the meadow",
      },
      heavyRain: {
        label: "Heavy Rain",
        message: "The cottage glows through the downpour",
      },
      storm: {
        label: "Thunderstorm",
        message: "The cottage stays warm in the storm",
      },
      snow: {
        label: "Light Snow",
        message: "Snow falls slowly around the warm cottage",
      },
      fog: { label: "Mist", message: "Morning fog slows the hills down" },
      windy: { label: "Windy", message: "Wind combs through the grass" },
      night: {
        label: "Clear Night",
        message: "Stars are out; the cottage glows",
      },
    },
    directions: {
      东南风: "SE wind",
      东风: "E wind",
      东北风: "NE wind",
      北风: "N wind",
      西北风: "NW wind",
    },
    cities: {
      杭州: "Hangzhou",
      上海: "Shanghai",
      北京: "Beijing",
      成都: "Chengdu",
      苏州: "Suzhou",
      大理: "Dali",
    },
    seasons: {
      spring: "Spring",
      summer: "Summer",
      autumn: "Autumn",
      winter: "Winter",
    },
    phases: { dawn: "Dawn", day: "Day", dusk: "Dusk", night: "Night" },
    ui: {
      weather: "Weather",
      searchCity: "Search city",
      city: "City name",
      demoCities: "Demo cities",
      noCity: "No matching demo city",
      closeCitySearch: "Close city search",
      switchCity: "Switch city",
      feelsLike: "Feels like",
      yesterdaySnow: "Yesterday's snow still covers the ground",
      snowAbout: "About",
      accumulating: "accumulating",
      melting: "slowly melting",
      forecastNote: "forecast",
      apiData: "Weather data",
      demoData: "Demo data",
      localTime: "Local time",
      wind: "Wind",
      temperature: "Temp",
      humidity: "Humidity",
      uv: "UV",
      forecast: "3-day forecast",
      today: "Today",
      tomorrow: "Tomorrow",
      afterTomorrow: "Day after",
      snowTomorrow: "Snow remains tomorrow",
      dragHint: "Drag left or right",
      orbitHint: "360° orbit",
      weatherPreview: "Weather preview",
      chooseWeather: "Try another weather state",
      closeWeatherMenu: "Close weather menu",
      meltSnow: "Melt snow",
      thunderOn: "Thunder on",
      thunderOff: "Thunder off",
      previewLightning: "Preview lightning",
      autoOrbit: "Auto orbit",
      pauseOrbit: "Pause orbit",
      resetView: "Reset view",
      loading: "Waking the little pasture",
      retry: "Retry",
      loadFailed: "The little pasture could not load",
      reason: "View reason",
      sceneLabel: "Draggable 360-degree 3D miniature pasture",
      canvasLabel:
        "3D miniature pasture: drag to orbit, scroll to zoom, arrow keys adjust view, R resets",
    },
  },
};

export function readLanguage() {
  try {
    const saved = localStorage.getItem("pocket-meadow:language");
    return saved === "en" || saved === "zh"
      ? saved
      : navigator.language.toLowerCase().startsWith("zh")
        ? "zh"
        : "en";
  } catch {
    return "zh";
  }
}

export function saveLanguage(language) {
  try {
    localStorage.setItem("pocket-meadow:language", language);
  } catch {
    /* A blocked preference still works for the current session. */
  }
}
