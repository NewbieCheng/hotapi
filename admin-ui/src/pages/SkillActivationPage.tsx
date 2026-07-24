import { useEffect, useMemo, useState } from 'react'
import {
  issueSkillLicenses,
  listSkillProducts,
  type SkillLicenseRequest,
  type SkillLicenseResult,
  type SkillProduct
} from '../api/skillLicenseAdmin'
import { Alert, Badge, Button, Card, Chip, Select, TextArea, TextField } from '../components/ui'
import './SkillActivationPage.css'

const PACKAGER_RELEASE_URL =
  'https://github.com/NewbieCheng/company-skills-marketplace/releases/download/skill-protection-packager-v1.0.0/skill-protection-packager-v1.0.0.zip'

interface ParsedBatch {
  requests: SkillLicenseRequest[]
  invalidLines: Array<{ line: number; text: string }>
}

function parseBatchInput(raw: string, defaultPrefix: string): ParsedBatch {
  const requests: SkillLicenseRequest[] = []
  const invalidLines: Array<{ line: number; text: string }> = []
  let recognizedIndex = 0

  raw.split(/\r?\n/).forEach((sourceLine, lineIndex) => {
    const line = sourceLine.trim()
    if (!line) return
    const match = line.match(/HGD1-[A-Za-z0-9_-]+/)
    if (!match || match.index === undefined) {
      invalidLines.push({ line: lineIndex + 1, text: line.slice(0, 80) })
      return
    }
    recognizedIndex += 1
    const beforeCode = line
      .slice(0, match.index)
      .replace(/[\s|｜,，:：;；]+$/g, '')
      .trim()
    const fallback = `${defaultPrefix || 'customer'}-${String(recognizedIndex).padStart(3, '0')}`
    requests.push({
      customerId: beforeCode || fallback,
      requestCode: match[0]
    })
  })

  return { requests, invalidLines }
}

function downloadText(filename: string, content: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`
}

function successfulResults(results: SkillLicenseResult[]) {
  return results.filter((item) => item.ok)
}

export function SkillActivationPage() {
  const [tab, setTab] = useState<'issue' | 'package'>('issue')
  const [products, setProducts] = useState<SkillProduct[]>([])
  const [maxBatchCount, setMaxBatchCount] = useState(100)
  const [selectedProductKey, setSelectedProductKey] = useState('')
  const [customerPrefix, setCustomerPrefix] = useState('customer')
  const [batchInput, setBatchInput] = useState('')
  const [results, setResults] = useState<SkillLicenseResult[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [issuing, setIssuing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [packageProductId, setPackageProductId] = useState('my-skill')
  const [packageDisplayName, setPackageDisplayName] = useState('我的 Skill')
  const [packageVersion, setPackageVersion] = useState('1.0.0')
  const [packageMode, setPackageMode] = useState('hybrid')

  const parsed = useMemo(
    () => parseBatchInput(batchInput, customerPrefix.trim()),
    [batchInput, customerPrefix]
  )
  const selectedProduct = products.find(
    (product) => `${product.productId}@${product.major}` === selectedProductKey
  )

  const loadProducts = async () => {
    setLoadingProducts(true)
    setError('')
    try {
      const response = await listSkillProducts()
      setProducts(response.products)
      setMaxBatchCount(response.maxBatchCount)
      if (response.products.length) {
        setSelectedProductKey((current) => current || `${response.products[0].productId}@${response.products[0].major}`)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Skill 产品加载失败')
    } finally {
      setLoadingProducts(false)
    }
  }

  useEffect(() => {
    void loadProducts()
  }, [])

  const issueBatch = async () => {
    setError('')
    setNotice('')
    setResults([])
    if (!selectedProduct) return setError('请先选择 Skill 产品')
    if (!parsed.requests.length) return setError('没有识别到 HGD1 设备请求码')
    if (parsed.requests.length > maxBatchCount) {
      return setError(`一次最多处理 ${maxBatchCount} 条，请拆成多批`)
    }
    setIssuing(true)
    try {
      const response = await issueSkillLicenses(selectedProduct, parsed.requests)
      setResults(response.results)
      setNotice(`已完成：成功 ${response.successCount} 条，失败 ${response.failureCount} 条`)
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : '批量发码失败')
    } finally {
      setIssuing(false)
    }
  }

  const copyCode = async (text: string, message = '已复制') => {
    await navigator.clipboard.writeText(text)
    setNotice(message)
  }

  const copyAll = async () => {
    const success = successfulResults(results)
    if (!success.length) return setError('当前没有可复制的成功结果')
    await copyCode(
      success.map((item) => `${item.customerId} | ${item.licenseCode}`).join('\n'),
      `已复制 ${success.length} 条客户激活码`
    )
  }

  const exportCsv = () => {
    if (!results.length) return setError('当前没有可导出的结果')
    const header = ['状态', '客户编号', '设备编号', '许可证编号', '激活码或错误']
    const lines = results.map((item) => item.ok
      ? ['成功', item.customerId, item.deviceId, item.licenseId, item.licenseCode]
      : ['失败', item.customerId, '', '', item.error])
    downloadText(
      `skill-licenses-${new Date().toISOString().slice(0, 10)}.csv`,
      `\uFEFF${[header, ...lines].map((row) => row.map(csvCell).join(',')).join('\n')}`,
      'text/csv;charset=utf-8'
    )
    setNotice(`已导出 ${results.length} 条结果`)
  }

  const downloadProtectionConfig = () => {
    const productId = packageProductId.trim()
    const displayName = packageDisplayName.trim()
    if (!/^[a-z0-9][a-z0-9._-]{1,95}$/.test(productId)) {
      return setError('产品 ID 只能用小写字母、数字、点、下划线和横线')
    }
    const config = {
      schemaVersion: 1,
      productId,
      displayName,
      version: packageVersion.trim(),
      protectionMode: packageMode,
      license: {
        requestPrefix: 'HGD1',
        licensePrefix: 'HGL1',
        binding: 'customer-and-device',
        entitlement: 'perpetual-major'
      },
      protectedMarkdown: [],
      protectedCode: [],
      editableConfig: [],
      notes: '将本文件和原始 Skill 文件夹一起交给 $skill-protection-packager；不得上传公司私钥。'
    }
    downloadText(`${productId}.protection.json`, `${JSON.stringify(config, null, 2)}\n`, 'application/json')
    setNotice('保护配置已下载')
  }

  return (
    <section className="skill-activator">
      <div className="skill-activator__tabs" role="tablist" aria-label="Skill 工具">
        <Chip active={tab === 'issue'} onClick={() => setTab('issue')}>批量发码</Chip>
        <Chip active={tab === 'package'} onClick={() => setTab('package')}>打包发布</Chip>
      </div>

      {error ? <Alert tone="error" onClose={() => setError('')}>{error}</Alert> : null}
      {notice ? <Alert tone="success" onClose={() => setNotice('')}>{notice}</Alert> : null}

      {tab === 'issue' ? (
        <>
          <Card className="skill-flow-card">
            <div className="skill-flow-card__intro">
              <span className="skill-kicker">HGD1 → HGL1</span>
              <h2>把客户的机器请求码，换成专属激活码</h2>
              <p>客户只需发来 HGD1。这里一次最多处理 {maxBatchCount} 台设备，私钥只在服务器签发时使用。</p>
            </div>
            <div className="skill-flow-rail" aria-label="发码流程">
              <div className="skill-flow-rail__step">
                <span>1</span>
                <strong>客户发 HGD1</strong>
                <small>可公开的设备请求码</small>
              </div>
              <i aria-hidden>→</i>
              <div className="skill-flow-rail__step skill-flow-rail__step--active">
                <span>2</span>
                <strong>后台安全签发</strong>
                <small>绑定客户 + 设备 + 大版本</small>
              </div>
              <i aria-hidden>→</i>
              <div className="skill-flow-rail__step">
                <span>3</span>
                <strong>发回 HGL1</strong>
                <small>客户只粘贴一次</small>
              </div>
            </div>
          </Card>

          <div className="skill-issue-grid">
            <Card className="skill-input-card">
              <div className="skill-card-heading">
                <div>
                  <span className="skill-step-label">输入</span>
                  <h3>客户请求码</h3>
                </div>
                <Badge tone={parsed.invalidLines.length ? 'warning' : 'success'}>
                  识别 {parsed.requests.length} 条
                </Badge>
              </div>

              <div className="skill-form-row">
                <Select
                  label="授权产品"
                  value={selectedProductKey}
                  disabled={loadingProducts || !products.length}
                  options={products.map((product) => ({
                    value: `${product.productId}@${product.major}`,
                    label: `${product.displayName} · v${product.major}.x`
                  }))}
                  onChange={(event) => setSelectedProductKey(event.target.value)}
                />
                <TextField
                  label="未写客户编号时的前缀"
                  value={customerPrefix}
                  placeholder="customer"
                  onChange={(event) => setCustomerPrefix(event.target.value)}
                />
              </div>

              <TextArea
                className="skill-request-input"
                label="批量粘贴"
                value={batchInput}
                placeholder={'推荐格式：\n客户001 | HGD1-xxxxx\n客户002 | HGD1-yyyyy\n\n也可以每行只放一个 HGD1，系统自动编号。'}
                hint={`支持混合文本自动识别；一次最多 ${maxBatchCount} 条。`}
                onChange={(event) => setBatchInput(event.target.value)}
              />

              {parsed.invalidLines.length ? (
                <div className="skill-inline-warning">
                  未识别第 {parsed.invalidLines.slice(0, 5).map((item) => item.line).join('、')} 行
                  {parsed.invalidLines.length > 5 ? `等 ${parsed.invalidLines.length} 行` : ''}
                </div>
              ) : null}

              <div className="skill-card-actions">
                <Button
                  type="button"
                  loading={issuing}
                  disabled={loadingProducts || !parsed.requests.length}
                  onClick={() => void issueBatch()}
                >
                  生成 {parsed.requests.length || ''} 个专属激活码
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!batchInput}
                  onClick={() => {
                    setBatchInput('')
                    setResults([])
                    setNotice('')
                  }}
                >
                  清空
                </Button>
              </div>
            </Card>

            <Card className="skill-result-card">
              <div className="skill-card-heading">
                <div>
                  <span className="skill-step-label">输出</span>
                  <h3>客户激活码</h3>
                </div>
                {results.length ? (
                  <div className="skill-result-counts">
                    <Badge tone="success">{results.filter((item) => item.ok).length} 成功</Badge>
                    {results.some((item) => !item.ok) ? (
                      <Badge tone="danger">{results.filter((item) => !item.ok).length} 失败</Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {!results.length ? (
                <div className="skill-result-empty">
                  <span>HGL1</span>
                  <strong>生成结果会出现在这里</strong>
                  <p>同一安装包可以给所有客户；这里生成的激活码每个客户、每台电脑都不同。</p>
                </div>
              ) : (
                <div className="skill-result-list">
                  {results.map((item) => (
                    <article
                      className={`skill-result-item${item.ok ? '' : ' skill-result-item--error'}`}
                      key={`${item.index}-${item.customerId}`}
                    >
                      <div className="skill-result-item__top">
                        <strong>{item.customerId || `第 ${item.index + 1} 条`}</strong>
                        <Badge tone={item.ok ? 'success' : 'danger'}>{item.ok ? '已签发' : '失败'}</Badge>
                      </div>
                      {item.ok ? (
                        <>
                          <div className="skill-result-meta">
                            <span>{item.deviceId}</span>
                            <span>{item.licenseId}</span>
                          </div>
                          <code>{item.licenseCode}</code>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => void copyCode(item.licenseCode, `已复制 ${item.customerId} 的激活码`)}
                          >
                            复制这条
                          </Button>
                        </>
                      ) : <p>{item.error}</p>}
                    </article>
                  ))}
                </div>
              )}

              <div className="skill-card-actions">
                <Button type="button" disabled={!successfulResults(results).length} onClick={() => void copyAll()}>
                  复制全部成功项
                </Button>
                <Button type="button" variant="ghost" disabled={!results.length} onClick={exportCsv}>
                  导出 CSV
                </Button>
              </div>
            </Card>
          </div>
        </>
      ) : (
        <div className="skill-package-layout">
          <Card className="skill-package-card">
            <span className="skill-kicker">给制作 Skill 的小伙伴</span>
            <h2>三步做成可发码的通用安装包</h2>
            <div className="skill-package-steps">
              <article>
                <span>01</span>
                <div>
                  <strong>安装打包流程 Skill</strong>
                  <p>Windows 双击安装，Mac 运行安装命令；不会附带任何真实产品私钥。</p>
                </div>
              </article>
              <article>
                <span>02</span>
                <div>
                  <strong>选择保护模式</strong>
                  <p>只加密 MD、只编译核心代码，或两者混合。打包工具会先盘点再生成客户包。</p>
                </div>
              </article>
              <article>
                <span>03</span>
                <div>
                  <strong>发布一个通用包</strong>
                  <p>安装包只发布一次；之后客户发 HGD1，员工回到本页签发 HGL1。</p>
                </div>
              </article>
            </div>
            <a className="skill-download-link" href={PACKAGER_RELEASE_URL}>
              下载 Skill 加密与授权流程包
            </a>
          </Card>

          <Card className="skill-config-card">
            <div className="skill-card-heading">
              <div>
                <span className="skill-step-label">配置向导</span>
                <h3>生成 protection.json</h3>
              </div>
              <Badge>不含密钥</Badge>
            </div>
            <TextField
              label="产品 ID"
              value={packageProductId}
              hint="发布后保持不变，例如 sales-copywriter"
              onChange={(event) => setPackageProductId(event.target.value)}
            />
            <div className="skill-form-row">
              <TextField
                label="显示名称"
                value={packageDisplayName}
                onChange={(event) => setPackageDisplayName(event.target.value)}
              />
              <TextField
                label="版本"
                value={packageVersion}
                onChange={(event) => setPackageVersion(event.target.value)}
              />
            </div>
            <Select
              label="保护模式"
              value={packageMode}
              options={[
                { value: 'md-only', label: '只保护 Markdown（md-only）' },
                { value: 'code-only', label: '只保护核心代码（code-only）' },
                { value: 'hybrid', label: '文字 + 代码混合保护（hybrid）' }
              ]}
              onChange={(event) => setPackageMode(event.target.value)}
            />
            <div className="skill-config-command">
              <span>交给 Codex / Cursor 的一句话</span>
              <code>
                使用 $skill-protection-packager 分析这个 Skill，采用 {packageMode}，完成加密、授权和客户包。
              </code>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void copyCode(
                  `使用 $skill-protection-packager 分析这个 Skill，采用 ${packageMode}，完成加密、授权和客户包。`,
                  '一句话已复制'
                )}
              >
                复制一句话
              </Button>
            </div>
            <Button type="button" onClick={downloadProtectionConfig}>下载保护配置</Button>
            <p className="skill-security-note">
              原始 Skill 和公司私钥只留在内部。GitHub 只发布薄 Skill、加密包、运行器和公开安装说明。
            </p>
          </Card>
        </div>
      )}
    </section>
  )
}
