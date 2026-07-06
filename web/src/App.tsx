import { useEffect, useState } from "react";

function App() {
  const [message, setMessage] = useState("Yükleniyor...");

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

  return (
    <div style={{ padding: "40px", fontSize: "24px" }}>
      <h1>Toplantı Notları</h1>
      <p>Backend mesajı: {message}</p>
    </div>
  );
}

export default App;