import TopNav from "./_components/top-nav";

export default function ReposLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <TopNav />  
      {children}
    </div>
  );
}