# 分享功能完整说明

## 功能概述

MoodMix 现在支持完整的饮品分享功能，包括：
- ✅ 生成精美的分享卡片
- ✅ 生成分享链接
- ✅ 生成二维码
- ✅ 链接自动跳转到饮品详情页

## 使用方法

### 1. 生成分享内容

1. 打开任意饮品详情页
2. 点击底部的"分享"按钮
3. 等待分享卡片生成（1-2秒）
4. 分享弹窗会显示：
   - 精美的分享卡片图片
   - 分享链接二维码
   - 分享链接文本

### 2. 分享方式

#### 方式一：扫描二维码
- 使用手机扫描二维码
- 自动跳转到饮品详情页
- 无需复制粘贴

#### 方式二：复制链接
- 点击"复制分享链接"按钮
- 链接自动复制到剪贴板
- 发送给朋友或分享到社交媒体

#### 方式三：保存图片
- 点击"保存图片"按钮
- 分享卡片保存到本地相册
- 可以在社交媒体上分享图片

## 分享链接格式

### URL 格式
```
https://你的域名/?drink=饮品名称
```

### 实际示例
```
https://moodmix.example.com/?drink=玛格丽特
https://moodmix.example.com/?drink=Margarita
http://localhost:3003/?drink=A1鸡尾酒
```

### URL 编码示例
```
http://localhost:3003?drink=A1%E9%B8%A1%E5%B0%BE%E9%85%92
```

## 二维码功能

### 二维码特点
- **高容错率**：使用 Level H 纠错级别
- **清晰度高**：180x180 像素
- **易于扫描**：白色背景，黑色前景
- **即时生成**：无需等待，实时显示

### 二维码内容
二维码包含完整的分享链接，扫描后：
1. 自动打开浏览器
2. 访问分享链接
3. 跳转到饮品详情页

## 技术实现

### 1. 二维码生成

使用 `qrcode.react` 库生成二维码：

```javascript
import { QRCodeSVG } from 'qrcode.react';

<QRCodeSVG 
  value={getShareLink()}
  size={180}
  level="H"
  includeMargin={false}
  bgColor="#ffffff"
  fgColor="#000000"
/>
```

### 2. URL 参数处理

应用启动时自动检查 URL 参数：

```javascript
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

### 3. 分享卡片生成

使用 Canvas API 生成精美的分享卡片：

```javascript
const cardUrl = await generateShareCard({
  drink,
  note: drink.reason || '',
  date: new Date()
});
```

## 分享流程

### 发起分享
```
用户 A 打开饮品详情页
    ↓
点击"分享"按钮
    ↓
生成分享卡片 + 二维码
    ↓
选择分享方式（二维码/链接/图片）
    ↓
分享给用户 B
```

### 接收分享
```
用户 B 扫描二维码或点击链接
    ↓
应用解析 URL 参数
    ↓
查找对应饮品
    ↓
自动打开饮品详情页
```

## 界面展示

### 分享弹窗包含

1. **标题区域**
   - "分享卡片已生成"
   - 提示文字："长按保存图片或扫描二维码分享"

2. **分享卡片预览**
   - 3:4 比例的精美卡片
   - 包含饮品图片、名称、推荐理由等

3. **二维码区域**
   - 白色背景的二维码
   - 提示文字："扫描二维码访问饮品详情"

4. **链接显示**
   - 可点击选中的链接文本
   - 方便手动复制

5. **操作按钮**
   - 复制分享链接
   - 保存图片
   - 返回

## 测试方法

### 本地测试

1. 启动开发服务器：
```bash
npm start
```

2. 打开任意饮品详情页，点击分享按钮

3. 测试二维码：
   - 使用手机扫描二维码
   - 应该能打开对应饮品详情页

4. 测试链接：
   - 复制分享链接
   - 在新标签页打开
   - 应该自动跳转到对应饮品详情页

### 测试 URL

假设本地服务器运行在 `http://localhost:3003`：

```
http://localhost:3003/?drink=玛格丽特
http://localhost:3003/?drink=Margarita
http://localhost:3003/?drink=A1鸡尾酒
http://localhost:3003?drink=A1%E9%B8%A1%E5%B0%BE%E9%85%92
```

## 注意事项

### 1. 饮品数据加载
- 分享链接会在饮品数据加载完成后自动处理
- 确保网络连接正常

### 2. URL 编码
- 饮品名称会自动进行 URL 编码/解码
- 支持中英文饮品名称

### 3. 饮品匹配
- 支持多种名称格式匹配
- 不区分大小写
- 如果饮品不存在，不会显示任何内容

### 4. 二维码扫描
- 需要手机支持二维码扫描
- 建议使用微信、支付宝等常用扫码工具

## 依赖库

### qrcode.react
- **版本**：最新版
- **用途**：生成二维码
- **特点**：React 专用，使用简单
- **文档**：https://github.com/zpao/qrcode.react

## 未来改进

- [ ] 支持自定义饮品的分享
- [ ] 添加分享统计功能
- [ ] 支持更多分享平台（微信、微博等）
- [ ] 添加分享卡片自定义选项
- [ ] 二维码样式自定义（颜色、Logo 等）
- [ ] 分享到社交媒体的快捷按钮
- [ ] 分享历史记录

## 常见问题

### Q: 二维码扫描后无法打开？
A: 检查以下几点：
1. 确保应用正在运行
2. 检查 URL 是否正确
3. 确认饮品名称是否存在

### Q: 分享链接无法跳转？
A: 可能的原因：
1. 饮品数据未加载完成
2. 饮品名称不匹配
3. 网络连接问题

### Q: 如何自定义二维码样式？
A: 修改 `QRCodeSVG` 组件的属性：
- `bgColor`: 背景颜色
- `fgColor`: 前景颜色
- `size`: 二维码大小

## 总结

MoodMix 的分享功能提供了完整的分享体验：
- 🎨 精美的分享卡片
- 📱 便捷的二维码
- 🔗 灵活的分享链接
- 🚀 自动跳转功能

用户可以通过多种方式分享自己喜欢的饮品，让更多人发现和享受美味的饮品！🎉