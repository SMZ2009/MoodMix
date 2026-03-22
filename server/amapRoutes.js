/**
 * 高德地图 API 代理 — 供 llmProxy（开发）与 prodServer（生产）共用
 * GET /api/amap/nearby, /api/amap/regeo
 */

const AMAP_KEY = process.env.AMAP_KEY || process.env.REACT_APP_AMAP_KEY || '';

const successResponse = (res, data, meta = {}) => {
  res.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  });
};

const errorResponse = (res, statusCode, error, details = null) => {
  const response = {
    success: false,
    error,
    meta: {
      timestamp: new Date().toISOString()
    }
  };
  if (details && process.env.NODE_ENV !== 'production') {
    response.details = details;
  }
  res.status(statusCode).json(response);
};

/**
 * @param {import('express').Application} app
 * @param {{ getFetch: () => Promise<typeof fetch | null> }} deps
 */
function registerAmapRoutes(app, { getFetch }) {
  app.get('/api/amap/nearby', async (req, res) => {
    const { lng, lat, radius = 3000, keywords } = req.query;

    if (!lng || !lat) {
      return errorResponse(res, 400, '缺少 lng 或 lat 参数');
    }

    if (!AMAP_KEY) {
      return errorResponse(res, 500, '高德 API Key 未配置。请在 .env 中设置 AMAP_KEY。');
    }

    try {
      const currentFetch = await getFetch();
      if (!currentFetch) {
        return errorResponse(res, 500, 'Fetch implementation not found');
      }

      const urlBase = `https://restapi.amap.com/v3/place/around?`
        + `key=${AMAP_KEY}`
        + `&location=${lng},${lat}`
        + `&types=071301`
        + `&radius=${radius}`
        + `&offset=10`
        + `&sortrule=distance`;

      const keywordStr = typeof keywords === 'string' ? keywords.trim() : '';
      const url = keywordStr
        ? `${urlBase}&keywords=${encodeURIComponent(keywordStr)}`
        : urlBase;

      console.log('[Amap Nearby] Requesting:', url.replace(AMAP_KEY, '***'));

      const response = await currentFetch(url);
      const data = await response.json();

      const mapPoisToBars = (pois) => (pois || []).map((poi) => ({
        id: poi.id,
        name: poi.name,
        address: poi.address,
        distance: parseInt(poi.distance),
        location: poi.location,
        tel: poi.tel || '',
      }));

      const poisCount = data?.pois?.length ?? 0;
      if (data?.status === '1' && poisCount > 0) {
        const bars = mapPoisToBars(data.pois);
        successResponse(res, bars, {
          amapStatus: data.status,
          amapInfo: data.info,
          poisCount,
          usedFallback: false,
        });
        return;
      }

      const keywordFallback = keywordStr || '酒吧';
      const urlFallback = `https://restapi.amap.com/v3/place/around?`
        + `key=${AMAP_KEY}`
        + `&location=${lng},${lat}`
        + `&keywords=${encodeURIComponent(keywordFallback)}`
        + `&radius=${radius}`
        + `&offset=10`
        + `&sortrule=distance`;

      console.log('[Amap Nearby Fallback] Requesting:', urlFallback.replace(AMAP_KEY, '***'));
      const response2 = await currentFetch(urlFallback);
      const data2 = await response2.json();
      const poisCount2 = data2?.pois?.length ?? 0;

      if (data2?.status === '1' && poisCount2 > 0) {
        const bars = mapPoisToBars(data2.pois);
        successResponse(res, bars, {
          amapStatus: data2.status,
          amapInfo: data2.info,
          poisCount: poisCount2,
          usedFallback: true,
          initialAmapStatus: data?.status,
          initialAmapInfo: data?.info,
          initialPoisCount: poisCount,
        });
        return;
      }

      successResponse(res, [], {
        amapStatus: data?.status ?? data2?.status,
        amapInfo: data?.info ?? data2?.info,
        poisCount: poisCount2,
        usedFallback: true,
        initialPoisCount: poisCount,
      });
    } catch (error) {
      console.error('[Amap Nearby] Error:', error);
      errorResponse(res, 500, '附近搜索失败', error.message);
    }
  });

  app.get('/api/amap/regeo', async (req, res) => {
    const { lng, lat } = req.query;

    if (!lng || !lat) {
      return errorResponse(res, 400, '缺少 lng 或 lat 参数');
    }

    if (!AMAP_KEY) {
      return errorResponse(res, 500, '高德 API Key 未配置');
    }

    try {
      const currentFetch = await getFetch();
      if (!currentFetch) {
        return errorResponse(res, 500, 'Fetch implementation not found');
      }

      const url = `https://restapi.amap.com/v3/geocode/regeo?key=${AMAP_KEY}&location=${lng},${lat}`;
      const response = await currentFetch(url);
      const data = await response.json();

      if (data.status === '1') {
        const comp = data.regeocode?.addressComponent;
        const name = comp?.neighborhood?.name || comp?.township || '当前位置';
        successResponse(res, name);
      } else {
        successResponse(res, '当前位置');
      }
    } catch (error) {
      console.error('[Amap Regeo] Error:', error);
      successResponse(res, '当前位置');
    }
  });
}

module.exports = { registerAmapRoutes };
