# 分享功能使用说明

## 功能概述

现在每一种饮品都可以生成分享链接，用户点击分享链接后会自动跳转到对应饮品的详情页。

## 使用方法

### 1. 生成分享链接

1. 打开任意饮品详情页
2. 点击底部的"分享"按钮
3. 等待分享卡片生成（1-2秒）
4. 在弹窗中点击"复制分享链接"

### 2. 分享链接格式

生成的分享链接格式为：
```
https://你的域名/?drink=饮品名称
```

例如：
```
https://moodmix.example.com/?drink=玛格丽特
https://moodmix.example.com/?drink=Margarita
```

### 3. 使用分享链接

- **复制链接**：点击"复制分享链接"按钮，链接会自动复制到剪贴板
- **分享给朋友**：将复制的链接发送给朋友
- **保存图片**：点击"保存图片"按钮，将精美的分享卡片保存到本地

## 技术实现

### URL 参数处理

应用启动时会自动检查 URL 中的 `drink` 参数：

```javascript
// 处理分享链接：检查 URL 参数并自动打开对应饮品
useEffect(() => {
  const handleSharedDrink = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const drinkName = urlParams.get('drink');
    
    if (drinkName && apiDrinks.length > 0) {
      const decodedName = decodeURIComponent(drinkName);
      const foundDrink = apiDrinks.find(d => 
        d.name === decodedName || 
        d.name_cn === decodedName || 
        d.nameEn === decodedName ||
        d.name.toLowerCase() === decodedName.toLowerCase()
      );
      
      if (foundDrink) {
        setCurrentDrink(foundDrink);
        setActiveTab('explore');
      }
    }
  };

  if (apiDrinks.length > 0) {
    handleSharedDrink();
  }
}, [apiDrinks]);
```

### 饮品匹配逻辑

系统会通过以下方式匹配饮品：
1. 精确匹配饮品名称（name）
2. 匹配中文名称（name_cn）
3. 匹配英文名称（nameEn）
4. 不区分大小写匹配

### 分享卡片生成

使用 Canvas API 生成精美的分享卡片，包含：
- 饮品图片
- 饮品名称
- 推荐理由
- 当前日期
- MoodMix 品牌标识

## 测试方法

### 本地测试

1. 启动开发服务器：
```bash
npm start
```

2. 打开任意饮品详情页，点击分享按钮

3. 复制生成的分享链接

4. 在新标签页中打开链接，应该会自动跳转到对应饮品详情页

### 示例链接

假设你的本地开发服务器运行在 `http://localhost:3000`：

```
http://localhost:3000/?drink=玛格丽特
http://localhost:3000/?drink=Margarita
http://localhost:3000/?drink=莫吉托
```

## 注意事项

1. **饮品数据加载**：分享链接会在饮品数据加载完成后自动处理，确保饮品数据已加载
2. **URL 编码**：饮品名称会自动进行 URL 编码/解码
3. **不存在的饮品**：如果链接中的饮品不存在，不会显示任何内容
4. **自定义饮品**：目前只支持 API 饮品的分享，自定义饮品的分享功能待实现

## 未来改进

- [ ] 支持自定义饮品的分享
- [ ] 添加分享统计功能
- [ ] 支持更多分享平台（微信、微博等）
- [ ] 添加分享卡片自定义选项
- [ ] 支持分享到社交媒体平台