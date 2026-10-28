import React from "react";
import { Screen, Card, T } from "../../components/ui";
export default function Help() {
  return (
    <Screen title="Help & Support" back>
      {[
        [
          "Account access",
          "Use Sign in for an existing account. Use Change Password from Profile to update your password. Contact your workspace owner if verification email is unavailable.",
        ],
        [
          "Machines and plants",
          "Open Assets → Add machine. Select a plant or use Add plant. Edit machine details from the machine page.",
        ],
        [
          "Work orders",
          "Choose a machine and an active team member. Complete every checklist task before recording the repair outcome and closing the work order.",
        ],
        [
          "Machine summaries",
          "Chat summarizes stored readings, alerts, documents and maintenance. Missing records are shown explicitly; summaries are not diagnoses.",
        ],
        [
          "Documents and notifications",
          "Documents are stored privately. Automatic processing and remote push delivery require configured backend services.",
        ],
        [
          "Get support",
          "Contact your workspace owner or plant administrator. Include the screen name, exact error, app version and a screenshot. Never share passwords or login tokens.",
        ],
      ].map(([title, text]) => (
        <Card key={title} style={{ gap: 10 }}>
          <T style={{ fontSize: 18, fontWeight: "700" }}>{title}</T>
          <T muted>{text}</T>
        </Card>
      ))}
    </Screen>
  );
}
