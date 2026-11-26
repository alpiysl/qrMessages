import { AdminNav } from "./nav-link";

export default function AdminLoading() {
  return (
    <div className="admin">
      <header>
        <AdminNav />
      </header>
      <div className="page-loading" role="status">
        <span className="spinner lg" />
        Yükleniyor…
      </div>
    </div>
  );
}
