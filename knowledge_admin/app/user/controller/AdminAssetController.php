<?php
// +----------------------------------------------------------------------
// |万岳科技开源系统 [山东万岳信息科技有限公司]
// +----------------------------------------------------------------------
// | Copyright (c) 2020~2022 https://www.sdwanyue.com All rights reserved.
// +----------------------------------------------------------------------
// | 万岳科技相关开源系统代码并不是自由软件，未经授权许可不能去掉wanyue【万岳科技】相关版权并商用
// +----------------------------------------------------------------------
// | Author: 万岳科技开源官方 < wanyuekj2020@163.com >
// +----------------------------------------------------------------------

namespace app\user\controller;

use think\Db;
use cmf\controller\AdminBaseController;

class AdminAssetController extends AdminBaseController
{
    /**
     * 资源管理列表
     * @adminMenu(
     *     'name'   => '资源管理',
     *     'parent' => '',
     *     'display'=> false,
     *     'hasView'=> true,
     *     'order'  => 10000,
     *     'icon'   => 'file',
     *     'remark' => '资源管理列表',
     *     'param'  => ''
     * )
     */
    public function index()
    {
        $content = hook_one('user_admin_asset_index_view');

        if (!empty($content)) {
            return $content;
        }

        $join   = [
            ['__USER__ u', 'a.user_id = u.id']
        ];
        $result = Db::name('asset')->field('a.*,u.user_login,u.user_email,u.user_nickname')
            ->alias('a')->join($join)
            ->order('create_time', 'DESC')
            ->paginate(10);
        $this->assign('assets', $result->items());
        $this->assign('page', $result->render());
        return $this->fetch();
    }

    /**
     * 删除文件
     * @adminMenu(
     *     'name'   => '删除文件',
     *     'parent' => 'index',
     *     'display'=> false,
     *     'hasView'=> false,
     *     'order'  => 10000,
     *     'icon'   => '',
     *     'remark' => '删除文件',
     *     'param'  => ''
     * )
     */
    public function delete()
    {
        $id            = $this->request->param('id');
        $file_filePath = Db::name('asset')->where('id', $id)->value('file_path');
        $file          = 'upload/' . $file_filePath;
        $res = true;
        if (file_exists($file)) {
            $res = unlink($file);
        }
        if ($res) {
            Db::name('asset')->where('id', $id)->delete();
            $this->success('删除成功');
        } else {
            $this->error('删除失败');
        }
    }

}