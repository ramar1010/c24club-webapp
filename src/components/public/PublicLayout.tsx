import { Outlet } from "react-router-dom";

const PublicLayout = () => {
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <Outlet />
    </div>
  );
};

export default PublicLayout;
