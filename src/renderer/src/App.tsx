import React from 'react';
import { Route, Routes } from 'react-router';
import Layout from './pages/layout';
import Home from './pages';
import FileRename from './pages/file-rename';
import ImageDeduplication from './pages/image-deduplication';
import VideoDeduplication from './pages/video-deduplication';
import VideoConverter from './pages/video-converter';
import ImageOptimize from './pages/image-optimize';
import TwitterDownload from './pages/twitter-download';
import TelegramDownload from './pages/telegram-download';

function App(): React.JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />

        {/* 媒体处理工具 */}
        <Route path="image-deduplication" element={<ImageDeduplication />} />
        <Route path="video-deduplication" element={<VideoDeduplication />} />
        <Route path="video-converter" element={<VideoConverter />} />
        <Route path="image-optimize" element={<ImageOptimize />} />

        {/* 文件工具 */}
        <Route path="file-rename" element={<FileRename />} />

        {/* 社交媒体工具 */}
        <Route path="twitter-download" element={<TwitterDownload />} />
        <Route path="telegram-download" element={<TelegramDownload />} />
      </Route>
    </Routes>
  );
}

export default App;
