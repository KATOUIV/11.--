/**
 * 统一请求入口别名（对齐 adventure / horr 的 requestHandler / unifiedRequestHandler 命名）
 */
export {
  handleSherlockRequest as handleUnifiedRequest,
  handleSherlockReroll,
  type SherlockRequestData as UnifiedRequestData,
  type SherlockRequestType as UnifiedRequestType,
} from '../lib/sherlockRequestHandler';
