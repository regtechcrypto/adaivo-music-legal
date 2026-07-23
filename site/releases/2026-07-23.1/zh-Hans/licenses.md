# Adaivo Music 第三方声明

**发布版本：** 2026-07-23.1
**生效日期：** 2026-07-23

如中英文版本发生冲突，以英文版本为准，但适用法律禁止如此约定的除外。

## 范围

这是基于 Adaivo Music 提交 `c810e47c83771fafea1366a6a58d4762c553b751` 构建的当前版本所含声明，涵盖 `mobile/package-lock.json` 中记录的直接运行时 JavaScript 依赖，以及从已提交锁定/构建文件中可识别的 iOS Pods 与 Android 运行时组件系列。仓库不含完整的 Android 发布版解析后许可报告，因此本文不声称是完整的原生传递依赖清单。上线前，发布工程必须根据最终商店二进制文件重新生成并审阅原生声明。

Adaivo 创作的音乐、法律文本、代码及品牌材料不是开源内容，也不通过本声明授予许可。

## 运行时 JavaScript 软件包

- Apache-2.0：`@invertase/react-native-apple-authentication`、`react-native-track-player`。
- MIT：`@react-native-camera-roll/camera-roll`、`@react-native-clipboard/clipboard`、`@react-native-community/push-notification-ios`、`@react-native-google-signin/google-signin`、`@react-native/new-app-screen`、`@react-navigation/bottom-tabs`、`@react-navigation/native`、`@react-navigation/native-stack`、`buffer`、`react`、`react-native`、`react-native-app-auth`、`react-native-blob-util`、`react-native-get-random-values`、`react-native-iap`、`react-native-keychain`、`react-native-nitro-modules`、`react-native-qrcode-svg`、`react-native-quick-base64`、`react-native-quick-crypto`、`react-native-safe-area-context`、`react-native-screens`、`react-native-share`、`react-native-svg`、`react-native-view-shot`、`uuid`。

上述软件包许可标识来自精确锁文件的软件包元数据。经补丁修改的软件包继续适用其上游许可；本版本对 `react-native-blob-util` 和 `react-native-track-player` 应用本地补丁。

## 在发布输入中识别的原生组件

- Apache-2.0 系列：React Native Android/iOS 组件、Hermes、AppAuth、Google Sign-In 支持库、GoogleUtilities、GTMAppAuth、GTMSessionFetcher、PromisesObjC、PromisesSwift、NitroModules、NitroIap 及 OpenIAP。
- OpenSSL License / Apache-2.0：通过 `OpenSSL-Universal` 使用 OpenSSL 3.x。
- MIT 系列：Yoga 及其上游发行版指定为 MIT 的 React 相关组件。

已提交的 Gradle 配置将 Android 仅测试依赖排除在分发运行时之外。

## 必需许可文本

Apache License 2.0：https://www.apache.org/licenses/LICENSE-2.0

MIT License：https://opensource.org/license/mit

OpenSSL 许可信息：https://www.openssl.org/source/license.html

版权及署名仍归各上游作者和贡献者所有。上游声明和许可文本具有约束力；本摘要不取代其内容。
