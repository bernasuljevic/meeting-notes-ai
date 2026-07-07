// web/src/App.tsx

import { useEffect, useState } from "react";
import { Recorder } from "./components/Recorder";
import { MeetingHistory } from "./components/MeetingHistory";

function App() {
  const [message, setMessage] = useState("Yükleniyor...");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("http://localhost:5166/api/ping")
      .then((res) => res.json())
      .then((data) => {
        setMessage(data.message);
      })
      .catch(() => {
        setMessage("API bağlantı hatası");
      });
  }, []);
  function handleMeetingSaved() {
  setRefreshKey((prev) => prev + 1);
}

  return (
    <div
      style={{
        padding: "40px",
        display: "flex",
        flexDirection: "column",
        gap: "40px",
        alignItems: "center",
      }}
    >
      <div>
        <h1>Toplantı Notları</h1>
        <p>Backend mesajı: {message}</p>
      </div>

      <Recorder onMeetingSaved={handleMeetingSaved} />

      <MeetingHistory refreshKey={refreshKey} />
    </div>
  );
}

export default App;