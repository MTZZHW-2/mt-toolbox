import React from 'react';
import { ScrollArea } from '@renderer/components/base/scroll-area';
import { Link, Outlet } from 'react-router';
import { WrenchIcon } from 'lucide-react';
import logo from '@renderer/assets/logo.png';
import { toolCategories } from '@renderer/pages/tools.config';

interface NavLinkProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}
function NavLink({ to, icon: Icon, children }: NavLinkProps) {
  return (
    <Link to={to} className="flex w-fit items-center gap-2 whitespace-nowrap">
      <Icon className="size-4" />
      {children}
    </Link>
  );
}

interface NavGroupProps {
  title: string;
  children: React.ReactNode;
}
function NavGroup({ title, children }: NavGroupProps) {
  return (
    <div className="space-y-2">
      <div className="text-muted-foreground text-xs font-semibold uppercase">{title}</div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

export default function Layout() {
  return (
    <div className="flex h-screen w-screen">
      <div className="flex h-screen w-56 flex-col border-r">
        <div className="flex w-full items-center gap-2 border-b p-4">
          <img src={logo} alt="logo" className="size-8 rounded" />
          <span className="font-medium whitespace-nowrap">MT工具箱</span>
        </div>

        <ScrollArea className="h-full overflow-y-auto">
          <div className="flex flex-col gap-6 p-4">
            <NavLink to="/" icon={WrenchIcon}>
              总览
            </NavLink>

            {toolCategories.map((category) => (
              <NavGroup key={category.category} title={category.category}>
                {category.tools.map((tool) => (
                  <NavLink key={tool.id} to={tool.path} icon={tool.iconComponent}>
                    {tool.name}
                  </NavLink>
                ))}
              </NavGroup>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
