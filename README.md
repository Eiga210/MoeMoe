# Desktop Pet 🐱

一隻會住在你桌面上的養成系寵物,用 Electron 打造,跨平台(macOS / Windows / Linux)。

🌐 **[線上試玩](https://eiga210.github.io/MoeMoe/)** — 不用下載,直接在瀏覽器裡養(數值存在瀏覽器本機)。想要牠常駐桌面陪你的話,往下看下載版。

## 功能

- 浮動在桌面上的透明小視窗,寵物會在裡面走來走去、睡覺、反應互動
- 三個養成數值:飽食度 🍰、心情 😊、體力 ⚡,會隨時間自然下降
- 操作:
  - 🍰 餵食 — 提升飽食度與心情
  - 🦋 抓蝴蝶 — 提升心情,消耗體力與飽食度
  - 😴 睡覺 — 體力會隨時間回復,體力滿了自動醒來
  - 🎵 隨機音樂 — 用瀏覽器打開私藏歌單裡隨機一首
- 點擊寵物本體會揮手打招呼
- 關閉視窗後寵物會留在系統選單列(tray)繼續運作,離開再回來時數值會依照離線時間自動結算(最多結算 12 小時)
- 狀態會儲存在本機(Electron userData 目錄),重開程式也不會消失

## 下載安裝(不會用指令的人看這裡)

到 [Releases 頁面](https://github.com/Eiga210/MoeMoe/releases/latest) 下載,不用裝 Node.js、不用打指令:

**Mac(Apple Silicon)**
1. 下載 `Desktop Pet-x.x.x-arm64.dmg`
2. 雙擊打開,把「Desktop Pet」拖進「Applications」資料夾
3. 第一次打開時 macOS 會說「無法驗證開發者」— 這是因為沒有付費的開發者簽名,不是病毒。到「應用程式」資料夾找到 Desktop Pet,**按右鍵 → 打開**,再按一次「打開」確認,之後就能正常用雙擊開啟(只需要做這一次)

**Windows**
1. 下載 `Desktop Pet Setup x.x.x.exe`
2. 雙擊執行安裝精靈,一路下一步即可
3. 第一次執行可能跳出「Windows 已保護您的電腦」(SmartScreen)— 同樣是因為沒有付費簽章,不是病毒。點「其他資訊」→「仍要執行」即可(只需要做這一次)

## 開發者安裝與執行

```bash
npm install
npm start
```

## 打包成安裝檔

```bash
npm run dist              # 打包成目前這台機器的平台
npx electron-builder --win --x64   # 在 Mac 上跨平台打包 Windows 版
```
會在 `dist/` 資料夾產生安裝檔(未簽名,安裝方式同上面)。

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
