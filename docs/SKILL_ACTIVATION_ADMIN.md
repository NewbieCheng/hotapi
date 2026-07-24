# Skill 激活器：老板和员工使用说明

## 一句话理解

同一个加密 Skill 安装包可以发给所有客户；客户电脑生成不同的 `HGD1-` 请求码，公司后台再为这台电脑签发唯一的 `HGL1-` 激活码。

```text
客户安装通用包
→ 客户发来 HGD1
→ 员工登录后台
→ 后台用公司私钥签发 HGL1
→ 客户粘贴一次
→ 以后直接使用
```

## 员工怎么给客户发激活码

1. 打开 `https://abc.no996ai.cn/admin`，使用原后台密码登录。
2. 顶部选择“Skill 激活器”。
3. 选择要授权的 Skill 产品。
4. 粘贴客户发来的完整请求码。推荐一行一条：

   ```text
   customer-001 | HGD1-客户发来的完整内容
   customer-002 | HGD1-客户发来的完整内容
   ```

5. 点击“生成专属激活码”。
6. 复制对应客户的 `HGL1-`，或者导出 CSV 后逐个发送。

客户编号只允许使用字母、数字、点、下划线和横线。建议采用固定格式，例如 `公司简称-手机号后四位-序号`。

## 激活码是否都一样

不一样。

| 内容 | 是否可以共用 | 作用 |
|---|---:|---|
| GitHub 通用安装包 | 可以 | 所有客户安装同一个加密包 |
| HGD1 设备请求码 | 不可以 | 每台电脑自己的公开机器请求 |
| HGL1 激活码 | 不可以 | 同时绑定客户、设备、产品和大版本 |
| 公司签名私钥 | 绝不外发 | 证明激活码由公司签发 |
| 产品根密钥 | 绝不外发 | 解密该产品大版本的核心内容 |

客户 A 的 HGL1 即使转发给客户 B，B 的设备私钥也无法解开产品密钥。

## 客户只需要两句话

安装：

> 请从 https://github.com/NewbieCheng/company-skills-marketplace 安装 `social-media-hangge-moments`。按 catalog.json 下载并校验对应的 GitHub Release，在我的 Windows 或 macOS 上自动安装薄 Skill 和本地运行器；不要让我安装 Git、手工解压或手工打开 EXE。安装完成后返回航哥朋友圈的 HGD1 设备请求码。

激活：

> 激活航哥朋友圈，激活码：HGL1-这里粘贴公司发来的完整激活码

激活码只粘贴一次，不需要每次调用都输入。运行时每次调用会自动验签并在内存中解密。

## 新 Skill 怎么接入

1. 在后台“Skill 激活器 → 打包发布”下载 `skill-protection-packager`。
2. 安装后，把原始 Skill 文件夹交给 Codex 或 Cursor：

   ```text
   使用 $skill-protection-packager 分析这个 Skill，采用 hybrid，完成加密、授权和客户包。
   ```

3. 根据实际资产选择：

   - `md-only`：只保护核心 Markdown；
   - `code-only`：只把核心代码编译为二进制；
   - `hybrid`：同时保护文字和代码，创业公司一期默认推荐。

4. 工具会为新产品生成独立的产品根密钥。将产品信息添加到 Vercel 的 `SKILL_LICENSE_PRODUCTS_JSON`，不要把根密钥写入 Git。
5. 发布通用客户包到 GitHub Release，并在 marketplace 的 `catalog.json` 增加安装入口。
6. 客户产生 HGD1 后，员工继续使用同一个后台签发。

## 服务端配置

生产环境需要两个仅服务端可见的环境变量：

```text
SKILL_VENDOR_SIGNING_KEY_B64
SKILL_LICENSE_PRODUCTS_JSON
```

产品注册表示例只展示结构，真实 `rootKeyB64` 不得提交到仓库：

```json
[
  {
    "productId": "hangge-peng-you-quan",
    "displayName": "航哥朋友圈",
    "major": 1,
    "rootKeyB64": "真实的32字节产品根密钥Base64"
  }
]
```

同一产品的 `1.0 → 1.9` 复用 `major: 1`；发布 `2.0` 时生成新的产品根密钥并重新授权。

## 安全边界

- 浏览器永远拿不到公司签名私钥和产品根密钥。
- 后台接口需要原有 `ADMIN_PASSWORD`，并限制一次最多 100 条。
- 正常响应只返回激活码和公开标识，不返回任何公司私钥。
- 一期是浅层、离线设备绑定，能防普通复制、跨设备共享和随手篡改。
- 无法承诺抵抗管理员调试、内存抓取和长期专业逆向。
- 完全离线许可证无法远程撤销；换机需要根据客户台账重新签发。
