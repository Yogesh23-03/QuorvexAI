import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";
import AICoreLoader from "../ui/AICoreLoader";

export default function RouteGuard({ children }) {
  const { userData, status } = useSelector((state) => state.user);
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <AICoreLoader label="Establishing session" />
      </div>
    );
  }

  if (!userData) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
