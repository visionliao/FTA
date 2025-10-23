#!/usr/bin/env python3
import sys
from pathlib import Path
import re

def main():
    """
    主函数，用于分析指定目录下的日志文件，并对回复进行多层分类统计。
    """
    if len(sys.argv) != 2:
        print("用法: python analyze_logs.py <目录路径>")
        print("例如: python analyze_logs.py output/result/251022_185914")
        return
    
    base_path = sys.argv[1]
    base_dir = Path(base_path)
    
    if not base_dir.is_dir():
        print(f"错误: 目录不存在或不是一个有效的目录: '{base_path}'")
        return

    # 正确回复的分类列表
    truly_correct_dirs = []
    mcp_error_dirs = []
    
    # 错误回复的详细分类列表
    malformed_call_dirs = [] # 类型1
    model_call_failure_dirs = [] # 类型2
    refusal_to_reason_dirs = [] # 类型3a
    plan_as_answer_dirs = [] # 类型3b
    # 类型4的子分类
    empty_reply_after_tool_call_dirs = [] # 类型4a
    reasoned_impossible_dirs = [] # 类型4b
    missing_function_call_info_dirs = [] # 类型4c

    total_processed_dirs = 0
    
    subdirs = sorted(
        [d for d in base_dir.iterdir() if d.is_dir()],
        key=lambda x: int(x.name) if x.name.isdigit() else float('inf')
    )

    for subdir in subdirs:
        log_file = subdir / 'log.txt'
        if not log_file.exists():
            continue
            
        total_processed_dirs += 1
        
        try:
            content = log_file.read_text(encoding='utf-8')
            
            google_answer_count = content.count('--- google模型回答 ---')
            
            final_reply_is_valid = False
            final_reply_content = "" # 确保在作用域内可访问
            parts = re.split(r'--- 最终答复 ---', content)
            if len(parts) > 1:
                final_reply_content = parts[-1].strip()
                if final_reply_content and '男性' in final_reply_content and '女性' in final_reply_content:
                    final_reply_is_valid = True
            
            # --- 分类逻辑 ---
            if google_answer_count >= 2 and final_reply_is_valid:
                if final_reply_content.count('23') >= 2:
                    truly_correct_dirs.append(subdir.name)
                else:
                    mcp_error_dirs.append(subdir.name)
            else:
                # 进入“错误回复”的详细子分类
                if 'MALFORMED_FUNCTION_CALL' in content:
                    malformed_call_dirs.append(subdir.name)
                elif 'N/A (调用失败)' in content:
                    model_call_failure_dirs.append(subdir.name)
                elif 'functionCall' not in content:
                    if '抱歉' in content and '无法' in content:
                        refusal_to_reason_dirs.append(subdir.name)
                    else:
                        plan_as_answer_dirs.append(subdir.name)
                else:
                    # 进入“类型4”的子分类判断
                    if not final_reply_content:
                        empty_reply_after_tool_call_dirs.append(subdir.name)
                    elif '我无法' in content:
                        reasoned_impossible_dirs.append(subdir.name)
                    else:
                        missing_function_call_info_dirs.append(subdir.name)
                    
        except Exception as e:
            print(f"处理目录 '{subdir.name}' 时发生错误: {e}")
            missing_function_call_info_dirs.append(subdir.name)
    
    # --- 打印最终的统计报告 ---
    
    if total_processed_dirs == 0:
        print(f"在目录 '{base_path}' 中未找到任何包含 log.txt 的子目录进行分析。")
        return
        
    # 计算各类别的数量
    counts = {
        'truly_correct': len(truly_correct_dirs),
        'mcp_error': len(mcp_error_dirs),
        'malformed': len(malformed_call_dirs),
        'model_failure': len(model_call_failure_dirs),
        'refusal': len(refusal_to_reason_dirs),
        'plan_as_answer': len(plan_as_answer_dirs),
        'empty_reply': len(empty_reply_after_tool_call_dirs),
        'reasoned_impossible': len(reasoned_impossible_dirs),
        'missing_info': len(missing_function_call_info_dirs),
    }

    # 计算总计
    total_correct_count = counts['truly_correct'] + counts['mcp_error']
    total_type3_error_count = counts['refusal'] + counts['plan_as_answer']
    total_type4_error_count = counts['empty_reply'] + counts['reasoned_impossible'] + counts['missing_info']
    total_error_count = (counts['malformed'] + counts['model_failure'] + 
                         total_type3_error_count + total_type4_error_count)
    
    # 计算百分比
    rates = {}
    for key, count in counts.items():
        rates[key] = (count / total_processed_dirs) * 100 if total_processed_dirs > 0 else 0
    rates['total_correct'] = (total_correct_count / total_processed_dirs) * 100 if total_processed_dirs > 0 else 0
    rates['total_error'] = (total_error_count / total_processed_dirs) * 100 if total_processed_dirs > 0 else 0

    # --- 格式化输出 ---
    print("\n" + "="*40)
    print("           日 志 分 析 结 果")
    print("="*40)
    print(f"总共分析的子目录数: {total_processed_dirs}")
    print("-" * 40)

    print(f"\n✅ 得到最终回复子目录 (总计) ({total_correct_count}个, 占比: {rates['total_correct']:.2f}%):")
    if total_correct_count > 0:
        if truly_correct_dirs: # 检查列表是否为空
            print(f"    - 🟢 最终结果计算正确 ({counts['truly_correct']}个, 占比: {rates['truly_correct']:.2f}%)")
            print(f"      {' '.join(sorted(truly_correct_dirs, key=int))}") # 增加了这一行
        if mcp_error_dirs: # 检查列表是否为空
            print(f"    - 🟡 最终结果计算错误 ({counts['mcp_error']}个, 占比: {rates['mcp_error']:.2f}%)")
            print(f"      {' '.join(sorted(mcp_error_dirs, key=int))}") # 增加了这一行
    else:
        print("  (无)")
    
    print(f"\n❌ 没有最终回复子目录 (总计) ({total_error_count}个, 占比: {rates['total_error']:.2f}%):")
    if total_error_count > 0:
        if malformed_call_dirs:
            print(f"    - 🔴 [类型1] 大模型返回错误的工具调用信息 ({counts['malformed']}个, 占比: {rates['malformed']:.2f}%)")
            print(f"      {' '.join(sorted(malformed_call_dirs, key=int))}")
        if model_call_failure_dirs:
            print(f"    - 🟤 [类型2] 调用大模型失败 ({counts['model_failure']}个, 占比: {rates['model_failure']:.2f}%)")
            print(f"      {' '.join(sorted(model_call_failure_dirs, key=int))}")
        if total_type3_error_count > 0:
            print(f"    - 🟠 [类型3] 直接回复最终答案 (总计: {total_type3_error_count}个)")
            if refusal_to_reason_dirs:
                print(f"      - 🙅 [3a] 大模型拒绝推理 ({counts['refusal']}个, 占比: {rates['refusal']:.2f}%)")
                print(f"        {' '.join(sorted(refusal_to_reason_dirs, key=int))}")
            if plan_as_answer_dirs:
                print(f"      - 📝 [3b] 将工具调用规划步骤作为最终答案 ({counts['plan_as_answer']}个, 占比: {rates['plan_as_answer']:.2f}%)")
                print(f"        {' '.join(sorted(plan_as_answer_dirs, key=int))}")
        if total_type4_error_count > 0:
            print(f"    - ⚪️ [类型4] 大模型意外终止 (总计: {total_type4_error_count}个)")
            if empty_reply_after_tool_call_dirs:
                print(f"      - 🕳️ [4a] 调用工具后返回空值 ({counts['empty_reply']}个, 占比: {rates['empty_reply']:.2f}%)")
                print(f"        {' '.join(sorted(empty_reply_after_tool_call_dirs, key=int))}")
            if reasoned_impossible_dirs:
                print(f"      - 🤷 [4b] 推理后判断无法查询 ({counts['reasoned_impossible']}个, 占比: {rates['reasoned_impossible']:.2f}%)")
                print(f"        {' '.join(sorted(reasoned_impossible_dirs, key=int))}")
            if missing_function_call_info_dirs:
                print(f"      - 🧩 [4c] 返回内容缺少function call ({counts['missing_info']}个, 占比: {rates['missing_info']:.2f}%)")
                print(f"        {' '.join(sorted(missing_function_call_info_dirs, key=int))}")
    else:
        print("  (无)")
    print("\n" + "="*40)

if __name__ == "__main__":
    main()