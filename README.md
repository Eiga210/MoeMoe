# Desktop Pet 🐱

一隻會住在你桌面上的養成系寵物,用 Electron 打造,跨平台(macOS / Windows / Linux)。

## 功能

- 浮動在桌面上的透明小視窗,寵物會在裡面走來走去、睡覺、反應互動
- 三個養成數值:飽食度 🍖、心情 😊、體力 ⚡,會隨時間自然下降
- 操作:
  - 🍖 餵食 — 提升飽食度與心情
  - 🎾 玩耍 — 提升心情,消耗體力與飽食度
  - 😴 睡覺 — 體力會隨時間回復,體力滿了自動醒來
- 關閉視窗後寵物會留在系統選單列(tray)繼續運作,離開再回來時數值會依照離線時間自動結算(最多結算 12 小時)
- 狀態會儲存在本機(Electron userData 目錄),重開程式也不會消失

## 安裝與執行

```bash
npm install
npm start
```

## 專案結構

```
main.js            # Electron 主程序:視窗、tray、狀態與計時邏輯
preload.js         # 安全地把 petAPI 暴露給 renderer
renderer/
  index.html
  style.css
  renderer.js       # 畫面渲染、走動動畫、按鈕互動
```

## License

MIT
