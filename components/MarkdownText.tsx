import React from "react";
import { Text, View } from "react-native";
import { T } from "./ui";
// Native text only: render common assistant Markdown without HTML or remote content.
export default function MarkdownText({ content }: { content: string }) {
  return (
    <View style={{ gap: 7 }}>
      {content.split("\n").map((line, index) => {
        const heading = /^#{1,6}\s/.test(line),
          bullet = /^\s*[-*]\s/.test(line);
        const text = line.replace(/^#{1,6}\s/, "").replace(/^\s*[-*]\s/, "• ");
        return (
          <T
            key={index}
            style={{
              fontSize: heading ? 15 : 13,
              fontWeight: heading ? "700" : "400",
              paddingLeft: bullet ? 4 : 0,
              lineHeight: 20,
            }}
          >
            {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => (
              <Text
                key={i}
                style={
                  part.startsWith("**")
                    ? { fontWeight: "700" }
                    : part.startsWith("`")
                      ? { fontFamily: "monospace" }
                      : undefined
                }
              >
                {part.startsWith("**")
                  ? part.slice(2, -2)
                  : part.startsWith("`")
                    ? part.slice(1, -1)
                    : part}
              </Text>
            ))}
          </T>
        );
      })}
    </View>
  );
}
