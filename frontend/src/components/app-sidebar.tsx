import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail } from "./ui/sidebar";
import React from "react";

export function AppSidebar({
	header,
	content,
	...props
}: React.ComponentProps<typeof Sidebar> & { header?: React.ReactNode, content?: React.ReactNode }) {
	return (
		<Sidebar {...props}>
			<SidebarHeader>
				{header}
			</SidebarHeader>
			<SidebarContent>
				{/* content is rendered here */}
				<SidebarGroup>
					<SidebarGroupLabel>Information</SidebarGroupLabel>
					<SidebarGroupContent>
						{content}
					</SidebarGroupContent>
				</SidebarGroup>
				{/* We create a SidebarGroup for each parent. */}
			</SidebarContent>
			<SidebarRail />
		</Sidebar>
	)
}

// --- Example usage ---
// <AppSidebar extraContent={<div>Contenu supplémentaire</div>} />