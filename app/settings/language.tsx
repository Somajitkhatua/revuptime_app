import React from "react";
import { Screen, Card, T, Badge } from "../../components/ui";
export default function Language() {
  return (
    <Screen title="Language" back>
      <Card style={{ gap: 14 }}>
        <T style={{ fontSize: 18, fontWeight: "700" }}>App language</T>
        <T>English (India)</T>
        <Badge value="Selected" />
        <T muted>
          English is currently the supported language for menus, forms and
          maintenance workflows.
        </T>
      </Card>
    </Screen>
  );
}
