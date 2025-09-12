import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail } from "./ui/sidebar";
import React from "react";

export function AppSidebar({
	header,
	content,
	...props
}: React.ComponentProps<typeof Sidebar> & {
	header?: React.ReactNode;
	content?: React.ReactNode;
}) {
	return (
		<Sidebar {...props}>
			<SidebarHeader>
				{header}
			</SidebarHeader>
			<SidebarContent>
				{content}
			</SidebarContent>
			<SidebarRail />
		</Sidebar>
	);
}
