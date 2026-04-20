const currentVersion = process.versions.node;

const parseVersion = (version) => {
  const [major = "0", minor = "0", patch = "0"] = version.split(".");
  return {
    major: Number.parseInt(major, 10),
    minor: Number.parseInt(minor, 10),
    patch: Number.parseInt(patch, 10),
  };
};

const compareVersions = (left, right) => {
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
};

const isSupportedNodeVersion = (version) => {
  const parsed = parseVersion(version);
  const minimum20 = parseVersion("20.19.0");
  const minimum22 = parseVersion("22.12.0");

  if (parsed.major === 20) {
    return compareVersions(parsed, minimum20) >= 0;
  }

  if (parsed.major === 21) {
    return false;
  }

  if (parsed.major === 22) {
    return compareVersions(parsed, minimum22) >= 0;
  }

  return parsed.major > 22;
};

if (!isSupportedNodeVersion(currentVersion)) {
  console.error(
    [
      "",
      "Unsupported Node.js version for dag-hero.",
      `Detected: ${currentVersion}`,
      "Required: ^20.19.0 || >=22.12.0",
      "",
      "Vite 8 requires a newer Node runtime.",
      "Switch to Node 20.19.0+ (or 22.12.0+) and re-run npm install.",
      "",
    ].join("\n")
  );

  process.exit(1);
}
