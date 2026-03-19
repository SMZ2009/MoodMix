const SEARCH_RADIUS = 3000;

const API_BASE = process.env.REACT_APP_API_URL
  || (window.location.hostname === 'localhost' ? '' : window.location.origin);

/**
 * 获取用户定位（浏览器 Geolocation API）
 */
export function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('浏览器不支持定位'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

/**
 * 搜索附近酒吧 — 通过后端代理转发高德 API，避免 CORS 和 key 泄露
 * 高德 POI 类型码：071301 = 酒吧
 */
export async function searchNearbyBars(lng, lat) {
  try {
    const url = `${API_BASE}/api/amap/nearby?lng=${lng}&lat=${lat}&radius=${SEARCH_RADIUS}`;
    const res = await fetch(url);
    const json = await res.json();

    if (json.success && json.data?.length > 0) {
      return json.data;
    }
    return [];
  } catch (error) {
    console.error('POI search failed:', error);
    return [];
  }
}

/**
 * 逆地理编码 — 经纬度转地名（通过后端代理）
 */
export async function reverseGeocode(lng, lat) {
  try {
    const url = `${API_BASE}/api/amap/regeo?lng=${lng}&lat=${lat}`;
    const res = await fetch(url);
    const json = await res.json();

    if (json.success && json.data) {
      return json.data;
    }
  } catch (e) {
    console.error('Reverse geocode failed:', e);
  }
  return '当前位置';
}
