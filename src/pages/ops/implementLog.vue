<route lang="json5">
{
  style: { navigationBarTitleText: '项目实施' },
}
</route>

<template>
  <PageLayout class="implementation-layout" :navbarShow="false">
    <view class="steps">
      <view
        v-for="(item, index) in mainSteps"
        :key="item"
        class="step"
        :class="{
          on: index === mainStep,
          done: index < mainStep || session.status === 'COMPLETED',
        }"
      >
        <text class="step__dot">
          {{ index < mainStep || session.status === 'COMPLETED' ? '✓' : index + 1 }}
        </text>
        <text>{{ item }}</text>
      </view>
    </view>

    <scroll-view class="page" :scroll-y="true">
      <view v-if="loading" class="empty">正在恢复本次实施进度…</view>

      <!-- ① 签到 -->
      <template v-else-if="mainStep === 0">
        <SectionCard title="本次实施项目">
          <view class="form-row">
            <text class="label">选择项目</text>
            <view
              class="picker-value picker-value--select select-control"
              :class="{ placeholder: !project.id }"
              @click="openProjectPicker"
            >
              <text class="select-control__text">
                {{ project.id ? projectOptionText(project) : '输入主项目或分期项目名称' }}
              </text>
              <wd-icon name="arrow-down" size="16px" color="#176ac7" />
            </view>
          </view>
          <template v-if="project.id">
            <view class="row">
              <text class="label">客户名称</text>
              <text class="val">{{ project.customerName }}</text>
            </view>
            <view class="form-row">
              <text class="label">实施工序</text>
              <picker
                class="select-picker"
                mode="selector"
                :disabled="processesLoading || !processes.length"
                :range="processNames"
                :value="selectedProcessIndex"
                @change="onProcess"
              >
                <view
                  class="picker-value picker-value--select select-control"
                  :class="{ placeholder: !project.processId }"
                >
                  <text class="select-control__text">
                    {{
                      processesLoading ? '正在加载工序…' : project.currentProcess || '暂无可选工序'
                    }}
                  </text>
                  <wd-icon
                    name="arrow-down"
                    size="16px"
                    :color="processesLoading || !processes.length ? '#9ca3af' : '#176ac7'"
                  />
                </view>
              </picker>
            </view>
            <view class="row">
              <text class="label">计划时间</text>
              <text class="val">{{ project.processPlan || '未设置计划时间' }}</text>
            </view>
          </template>
        </SectionCard>
        <SectionCard title="签到定位">
          <LocationPanel
            :location="location"
            :locating="locating"
            :sites="implementationSites"
            @refresh="getLocation"
          />
        </SectionCard>
        <SectionCard v-if="isSignInLocationAbnormal" title="签到位置异常说明">
          <view class="warning">
            当前签到位置不在项目任一实施地点200米范围内，请填写真实原因并上传现场照片。
          </view>
          <textarea
            v-model="signInRemark"
            class="reason"
            maxlength="500"
            placeholder="请输入签到位置异常原因（必填）"
            placeholder-style="color:#767676"
          />
          <view class="form-row top photo-field">
            <text class="label">现场照片</text>
            <view class="photos">
              <view v-for="(photo, index) in signInPhotos" :key="photo" class="photo">
                <image :src="photo" mode="aspectFill" />
                <text @click="signInPhotos.splice(index, 1)">×</text>
              </view>
              <view v-if="signInPhotos.length < 3" class="photo add-photo" @click="addSignInPhoto">
                添加
              </view>
            </view>
          </view>
        </SectionCard>
        <view class="flow-tip">签到成功后才能填写实施日志，本次记录会自动关联项目和当前工序。</view>
      </template>

      <!-- ② 日志 -->
      <template v-else-if="mainStep === 1">
        <view v-if="resumingPreviousFlow" class="recovery-notice">
          <wd-icon name="warning" size="18px" color="#8a5a13" />
          <text>正在继续上一次未完成的实施流程，完成签退后才能再次签到。</text>
        </view>
        <view class="session-strip">
          <view>
            <view class="session-strip__title">实施进行中</view>
            <view class="session-strip__meta">
              {{ project.name }} · {{ project.currentProcess }}
            </view>
          </view>
          <view class="session-strip__time">
            <text>签到 {{ shortTime(session.checkInTime) }}</text>
            <text>已持续 {{ elapsedText }}</text>
          </view>
        </view>
        <view class="sub-steps">
          <view
            v-for="(item, index) in logSteps"
            :key="item"
            class="sub-step"
            :class="{ on: index === logStep, done: index < logStep }"
          >
            <text>{{ index < logStep ? '✓' : index + 1 }} {{ item }}</text>
          </view>
        </view>

        <SectionCard v-if="logStep === 0" title="项目信息">
          <view class="row">
            <text class="label">项目名称</text>
            <text class="val">{{ project.name }}</text>
          </view>
          <view class="row">
            <text class="label">客户名称</text>
            <text class="val">{{ project.customerName }}</text>
          </view>
          <view class="row">
            <text class="label">当前工序</text>
            <text class="val">{{ project.currentProcess }}</text>
          </view>
          <view class="row">
            <text class="label">计划周期</text>
            <text class="val">
              {{ project.processPlan || `${project.startDate} ~ ${project.endDate}` }}
            </text>
          </view>
          <view class="row">
            <text class="label">剩余工期</text>
            <text class="val" :class="{ warn: project.remainDays < 0 }">{{ remainDaysText }}</text>
          </view>
        </SectionCard>

        <SectionCard v-if="logStep === 1" title="实施记录">
          <view class="form-row">
            <text class="label">实施位置</text>
            <input
              v-model="form.location"
              class="input"
              placeholder="填写楼层、机房或具体点位"
              placeholder-style="color:#767676"
            />
          </view>
          <view class="form-row top">
            <text class="label">实施内容</text>
            <textarea
              v-model="form.content"
              class="textarea"
              placeholder="填写本次实施内容和完成情况"
              placeholder-style="color:#767676"
            />
          </view>
          <view class="form-row top">
            <text class="label">现场照片</text>
            <view class="photos">
              <view v-for="(photo, index) in photos" :key="photo" class="photo">
                <image :src="photo" mode="aspectFill" />
                <text @click="photos.splice(index, 1)">×</text>
              </view>
              <view v-if="photos.length < 3" class="photo add-photo" @click="addPhoto">添加</view>
            </view>
          </view>
          <view v-if="!isSiteLeader" class="role-note">
            仅当前工序现场负责人可调整参与人员和外协信息。
          </view>
          <view class="form-row">
            <text class="label">其他参与人员</text>
            <view class="choice-group" :class="{ disabled: !isSiteLeader }">
              <text
                :class="{ on: !form.hasOtherParticipants }"
                @click="setOtherParticipants(false)"
              >
                否
              </text>
              <text :class="{ on: form.hasOtherParticipants }" @click="setOtherParticipants(true)">
                是
              </text>
            </view>
          </view>
          <view v-if="form.hasOtherParticipants" class="form-row top">
            <text class="label">选择人员</text>
            <view class="chips" :class="{ disabled: !isSiteLeader }">
              <text
                v-for="person in persons"
                :key="person.id"
                class="chip"
                :class="{ on: form.personIds.includes(person.id) }"
                @click="togglePerson(person.id)"
              >
                {{ person.name }}
              </text>
              <text
                v-if="membersError"
                class="inline-empty inline-empty--error"
                @click="loadMembers"
              >
                参与人员加载失败，点击重试
              </text>
              <text v-else-if="!persons.length" class="inline-empty">当前项目暂无其他可选人员</text>
            </view>
          </view>
          <view class="form-row">
            <text class="label">是否需外协</text>
            <view class="choice-group" :class="{ disabled: !isSiteLeader }">
              <text :class="{ on: !form.needsOutsource }" @click="setNeedsOutsource(false)">
                否
              </text>
              <text :class="{ on: form.needsOutsource }" @click="setNeedsOutsource(true)">是</text>
            </view>
          </view>
          <view v-if="form.needsOutsource" class="outsourcing-list">
            <view v-for="row in form.outsourcingList" :key="row.key" class="outsourcing-row">
              <view class="form-row">
                <text class="label">外协单位</text>
                <picker
                  mode="selector"
                  :range="outsourceNames"
                  :value="outsourceIndex(row.unitId)"
                  :disabled="!isSiteLeader"
                  @change="onOutsourceUnit(row, $event)"
                >
                  <view
                    class="picker-value picker-value--select"
                    :class="{ placeholder: !row.unitId }"
                  >
                    {{ row.unitName || '请选择计划外协单位' }}
                  </view>
                </picker>
              </view>
              <view class="outsourcing-fields">
                <view>
                  <text>人数</text>
                  <input
                    v-model="row.headcount"
                    type="number"
                    placeholder="0"
                    :disabled="!isSiteLeader"
                  />
                </view>
                <view>
                  <text>工时</text>
                  <input
                    v-model="row.workHours"
                    type="digit"
                    placeholder="0"
                    :disabled="!isSiteLeader"
                  />
                  <text>小时</text>
                </view>
                <text
                  v-if="isSiteLeader"
                  class="outsourcing-remove"
                  @click="removeOutsource(row.key)"
                >
                  删除
                </text>
              </view>
              <view v-if="row.plannedHeadcount || row.plannedWorkHours" class="outsourcing-plan">
                计划：{{ row.plannedHeadcount || 0 }} 人 · {{ row.plannedWorkHours || 0 }} 小时
              </view>
            </view>
            <view
              v-if="outsourcesError"
              class="inline-empty inline-empty--error"
              @click="loadOutsources"
            >
              计划外协加载失败，点击重试
            </view>
            <view v-else-if="!outsourceOptions.length" class="inline-empty">
              当前项目计划中暂无外协单位
            </view>
            <view v-else-if="isSiteLeader" class="material-select" @click="addOutsource">
              ＋ 添加当天外协
            </view>
          </view>
        </SectionCard>

        <template v-if="logStep === 2">
          <SectionCard title="行车记录">
            <view class="form-row">
              <text class="label">使用车辆</text>
              <input
                v-model.trim="form.plate"
                class="input"
                maxlength="20"
                placeholder="手动填写车牌号（选填）"
                placeholder-style="color:#767676"
              />
            </view>
            <view v-if="form.plate" class="form-row">
              <text class="label">行驶公里</text>
              <input
                v-model="form.mileage"
                class="input"
                type="digit"
                placeholder="请输入公里数"
                placeholder-style="color:#767676"
              />
              <text class="unit">km</text>
            </view>
          </SectionCard>
          <SectionCard title="用料记录（选填）">
            <view v-for="material in selectedMaterials" :key="material.id" class="material-row">
              <view class="material-copy">
                <view>{{ material.name }}</view>
                <text>
                  {{ material.spec || '暂无规格' }} · 本项目已出库 {{ material.outQty
                  }}{{ material.unit }} · 计划 {{ material.planQty }}{{ material.unit }}
                </text>
              </view>
              <view class="quantity">
                <input v-model="material.qty" type="digit" />
                <text>{{ material.unit }}</text>
              </view>
              <text class="material-remove" @click="removeMaterial(material.id)">移除</text>
            </view>
            <view v-if="!selectedMaterials.length" class="material-empty">
              本次未记录用料，可直接提交日志
            </view>
            <view
              class="material-select"
              :class="{ disabled: materialsLoading }"
              @click="openMaterialPicker"
            >
              {{
                materialsLoading
                  ? '正在加载已出库物料…'
                  : selectedMaterials.length
                    ? '重新选择物料'
                    : '选择物料'
              }}
            </view>
            <view
              v-if="materialsError"
              class="material-error"
              @click="loadProjectMaterials(project.id)"
            >
              已出库物料加载失败，点击重试
            </view>
          </SectionCard>
          <view class="flow-tip strong">
            提交日志后进入待签退状态；签退完成前，本次实施仍处于进行中。
          </view>
        </template>
      </template>

      <!-- ③ 签退 -->
      <template v-else-if="mainStep === 2">
        <view v-if="resumingPreviousFlow" class="recovery-notice">
          <wd-icon name="warning" size="18px" color="#8a5a13" />
          <text>上一次实施流程尚未签退，可现在签退或补签退。</text>
        </view>
        <SectionCard title="日志已保存">
          <view class="summary">
            <view>
              <text>实施内容</text>
              <text>{{ session.logData?.content || form.content }}</text>
            </view>
            <view>
              <text>签到时间</text>
              <text>{{ formatDateTime(session.checkInTime) }}</text>
            </view>
          </view>
          <view class="material-select" @click="returnToImplementationLog">查看实施日志</view>
        </SectionCard>
        <SectionCard title="签退定位">
          <LocationPanel
            :location="location"
            :locating="locating"
            :sites="implementationSites"
            @refresh="getLocation"
          />
        </SectionCard>
        <SectionCard v-if="isLocationAbnormal" title="位置异常说明">
          <view class="warning">当前签退位置异常。继续签退前，请填写真实原因并上传现场照片。</view>
          <textarea
            v-model="abnormalReason"
            class="reason"
            placeholder="请输入位置异常原因（必填）"
            placeholder-style="color:#767676"
          />
          <view class="form-row top photo-field">
            <text class="label">现场照片</text>
            <view class="photos">
              <view v-for="(photo, index) in signOutPhotos" :key="photo" class="photo">
                <image :src="photo" mode="aspectFill" />
                <text @click="signOutPhotos.splice(index, 1)">×</text>
              </view>
              <view
                v-if="signOutPhotos.length < 3"
                class="photo add-photo"
                @click="addSignOutPhoto"
              >
                添加
              </view>
            </view>
          </view>
        </SectionCard>
      </template>

      <!-- ④ 完成 -->
      <template v-else>
        <view class="complete-card">
          <view class="complete-icon">✓</view>
          <view class="complete-title">本次实施已完成</view>
          <view class="complete-no">{{ project.currentProcess }}</view>
          <view class="complete-list">
            <view>
              <text>项目名称</text>
              <text>{{ project.name }}</text>
            </view>
            <view>
              <text>到场时间</text>
              <text>{{ formatDateTime(session.checkInTime) }}</text>
            </view>
            <view>
              <text>签退时间</text>
              <text>{{ formatDateTime(session.checkOutTime) }}</text>
            </view>
            <view>
              <text>实施时长</text>
              <text>{{ session.duration || elapsedText }}</text>
            </view>
            <view>
              <text>定位状态</text>
              <text :class="{ danger: session.checkOutLocationStatus !== 'NORMAL' }">
                {{ session.checkOutLocationStatus === 'NORMAL' ? '正常' : '异常（已记录原因）' }}
              </text>
            </view>
          </view>
        </view>
        <view class="complete-actions">
          <text class="plain" @click="showLogDetail">查看日志</text>
          <text class="primary" @click="backToProject">返回项目</text>
        </view>
      </template>
    </scroll-view>

    <view v-if="!loading && session.status !== 'COMPLETED'" class="bottom">
      <text v-if="mainStep === 1 && logStep > 0" class="btn plain" @click="logStep--">上一步</text>
      <text
        v-if="mainStep === 1 && logStep > 0"
        class="btn plain"
        :class="{ disabled: submitting }"
        @click="saveDraft(false)"
      >
        保存草稿
      </text>
      <text
        v-if="mainStep === 2 && resumingPreviousFlow"
        class="btn plain"
        :class="{ disabled: submitting }"
        @click="openBackfill"
      >
        补签退
      </text>
      <text
        class="btn primary"
        :class="{ disabled: submitting || locating || processStatusLoading }"
        @click="primaryAction"
      >
        {{ primaryText }}
      </text>
    </view>

    <wd-popup
      v-model="showIncompleteFlow"
      position="bottom"
      :close-on-click-modal="false"
      custom-style="border-radius:16px 16px 0 0;"
    >
      <view class="recovery-popup">
        <view class="recovery-popup__icon">
          <wd-icon name="warning" size="26px" color="#8a5a13" />
        </view>
        <view class="recovery-popup__title">上一次实施流程未完成</view>
        <view class="recovery-popup__copy">
          你在当前项目分期的该工序有未签退记录。请先查看并完成上一次流程，之后才能再次签到。
        </view>
        <view class="recovery-popup__actions">
          <text class="btn plain" @click="showIncompleteFlow = false">更换工序</text>
          <text class="btn primary" :class="{ disabled: draftLoading }" @click="resumePreviousFlow">
            {{ draftLoading ? '正在加载…' : '继续上次流程' }}
          </text>
        </view>
      </view>
    </wd-popup>

    <wd-popup
      v-model="showBackfill"
      position="bottom"
      :close-on-click-modal="false"
      custom-style="border-radius:16px 16px 0 0;"
    >
      <view class="backfill-popup">
        <view class="project-popup__header">
          <view>
            <view class="project-popup__title">补签退</view>
            <view class="project-popup__hint">填写实际签退时间和未及时签退原因</view>
          </view>
          <text class="project-popup__close" @click="showBackfill = false">关闭</text>
        </view>
        <view class="backfill-popup__body">
          <wd-datetime-picker
            v-model="backfillTime"
            label="实际签退时间"
            type="datetime"
            :min-date="backfillMinTime"
            :max-date="backfillMaxTime"
            :use-second="true"
            required
          />
          <view class="backfill-field">
            <text class="backfill-field__label">未及时签退原因</text>
            <textarea
              v-model="backfillRemark"
              class="reason"
              maxlength="500"
              placeholder="请如实填写未及时签退的原因"
              placeholder-style="color:#767676"
            />
          </view>
        </view>
        <view class="recovery-popup__actions">
          <text class="btn plain" @click="showBackfill = false">取消</text>
          <text class="btn primary" :class="{ disabled: submitting }" @click="submitBackfill">
            {{ submitting ? '提交中…' : '确认补签退' }}
          </text>
        </view>
      </view>
    </wd-popup>

    <wd-popup
      v-model="showProjectPicker"
      position="bottom"
      custom-style="border-radius:16px 16px 0 0;"
    >
      <view class="project-popup">
        <view class="project-popup__header">
          <view>
            <view class="project-popup__title">选择实施项目</view>
            <view class="project-popup__hint">仅展示当前账号已参与的项目分期</view>
          </view>
          <text class="project-popup__close" @click="showProjectPicker = false">关闭</text>
        </view>
        <view class="material-search">
          <input
            v-model.trim="projectKeyword"
            class="material-search__input"
            placeholder="输入主项目或分期项目名称"
            placeholder-style="color:#767676"
            confirm-type="search"
          />
          <text v-if="projectKeyword" class="material-search__clear" @click="projectKeyword = ''">
            清空
          </text>
        </view>
        <scroll-view :scroll-y="true" class="project-popup__list">
          <view
            v-for="item in filteredProjects"
            :key="item.id"
            class="project-option"
            :class="{ on: String(item.id) === String(project.id) }"
            @click="selectProject(item)"
          >
            <view class="project-option__body">
              <text class="project-option__name">{{ item.projectName || '未命名项目' }}</text>
              <text class="project-option__period">{{ item.name || '未命名分期' }}</text>
            </view>
            <view class="project-option__check">
              <wd-icon
                v-if="String(item.id) === String(project.id)"
                name="check"
                size="16px"
                color="#176ac7"
              />
            </view>
          </view>
          <view v-if="projectsLoading" class="material-popup__empty">正在加载参与项目…</view>
          <view
            v-else-if="projectsError"
            class="material-popup__empty material-error"
            @click="loadParticipatedProjects"
          >
            参与项目加载失败，点击重试
          </view>
          <view v-else-if="!filteredProjects.length" class="material-popup__empty">
            {{ projectKeyword ? `没有找到匹配“${projectKeyword}”的项目` : '暂无已参与的项目' }}
          </view>
        </scroll-view>
      </view>
    </wd-popup>

    <wd-popup
      v-model="showMaterialPicker"
      position="bottom"
      custom-style="border-radius:16px 16px 0 0;"
    >
      <view class="material-popup">
        <view class="material-popup__header">
          <view>
            <view class="material-popup__title">选择本次使用的物料</view>
            <view class="material-popup__hint">仅展示当前项目已有出库数量的物料，可不选择</view>
          </view>
          <text class="material-popup__close" @click="showMaterialPicker = false">关闭</text>
        </view>
        <view class="material-search">
          <input
            v-model.trim="materialKeyword"
            class="material-search__input"
            placeholder="输入物料编号或名称"
            placeholder-style="color:#767676"
            confirm-type="search"
          />
          <text v-if="materialKeyword" class="material-search__clear" @click="materialKeyword = ''">
            清空
          </text>
        </view>
        <view class="material-popup__toolbar">
          <text>当前显示 {{ filteredIssuedMaterials.length }} 项</text>
          <text
            class="material-popup__select-all"
            :class="{ disabled: !filteredIssuedMaterials.length }"
            @click="toggleSelectAllMaterials"
          >
            {{ allFilteredMaterialsSelected ? '取消全选' : '全选' }}
          </text>
        </view>
        <scroll-view :scroll-y="true" class="material-popup__list">
          <view
            v-for="material in filteredIssuedMaterials"
            :key="material.id"
            class="material-option"
            :class="{ on: isMaterialSelected(material.id) }"
            @click="toggleMaterial(material)"
          >
            <view class="material-copy">
              <view>{{ material.name }}</view>
              <text>物料编号：{{ material.materialCode || '暂无编号' }}</text>
              <text>
                {{ material.spec || '暂无规格' }} · 已出库 {{ material.outQty
                }}{{ material.unit }} · 计划 {{ material.planQty }}{{ material.unit }}
              </text>
            </view>
            <view class="material-check">{{ isMaterialSelected(material.id) ? '✓' : '' }}</view>
          </view>
          <view
            v-if="materialKeyword && !filteredIssuedMaterials.length"
            class="material-popup__empty"
          >
            没有找到匹配“{{ materialKeyword }}”的已出库物料
          </view>
          <view v-else-if="!filteredIssuedMaterials.length" class="material-popup__empty">
            当前项目暂无已出库物料
          </view>
        </scroll-view>
        <view class="material-popup__footer">
          <text class="btn primary" @click="showMaterialPicker = false">完成</text>
        </view>
      </view>
    </wd-popup>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import { useMessage, useToast } from 'wot-design-uni'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import LocationPanel from './components/LocationPanel.vue'
import { http } from '@/utils/http'
import { useUserStore } from '@/store/user'
import { normalizeProject, projectApi, unwrapRecords } from '@/service/shkj'

type SessionStatus = 'NOT_STARTED' | 'CHECKED_IN' | 'LOG_DRAFT' | 'LOG_SUBMITTED' | 'COMPLETED'
type LocationStatus = 'PENDING' | 'NORMAL' | 'OUT_OF_RANGE' | 'FAILED' | 'NO_SITE'
type ImplementationSite = {
  id?: string
  locationName: string
  description?: string
  latitude: number
  longitude: number
}
type SiteLocation = {
  name: string
  address: string
  latitude?: number
  longitude?: number
  status: LocationStatus
  matchedSiteId?: string
  matchedSiteName?: string
  distance?: number
}
type Session = {
  periodId?: string
  project?: any
  processId?: string
  status: SessionStatus
  checkInTime?: string
  checkInLocation?: SiteLocation
  checkInType?: 'NORMAL' | 'EXCEPTION'
  signInRemark?: string
  signInPhotos?: string[]
  logStep?: number
  logData?: any
  sgNo?: string
  checkOutTime?: string
  checkOutLocation?: SiteLocation
  checkOutLocationStatus?: LocationStatus
  abnormalReason?: string
  duration?: string
}
type DictOption = {
  value: string
  label: string
}

const toast = useToast()
const message = useMessage()
const userStore = useUserStore()
const loading = ref(true)
const submitting = ref(false)
const locating = ref(false)
const routeProjectId = ref('')
const projects = ref<any[]>([])
const projectsLoading = ref(false)
const projectsError = ref(false)
const showProjectPicker = ref(false)
const projectKeyword = ref('')
const project = ref<any>({})
const processes = ref<any[]>([])
const processesLoading = ref(false)
const selectedProcessIndex = ref(0)
const workTypeOptions = ref<DictOption[]>([])
const processStatusLoading = ref(false)
const activeProcessStatus = ref('')
const unsignedStatusChecked = ref(false)
const hasUnsignedLog = ref(false)
const showIncompleteFlow = ref(false)
const draftLoading = ref(false)
const previousDraft = ref<any>()
const resumingPreviousFlow = ref(false)
const showBackfill = ref(false)
const backfillTime = ref(Date.now())
const backfillMaxTime = ref(Date.now())
const backfillRemark = ref('')
const implementationSites = ref<ImplementationSite[]>([])
const sitesLoading = ref(false)
const sitesError = ref(false)
const signInPhotos = ref<string[]>([])
const photos = ref<string[]>([])
const signOutPhotos = ref<string[]>([])
const issuedMaterials = ref<any[]>([])
const selectedMaterials = ref<any[]>([])
const materialsLoading = ref(false)
const materialsError = ref(false)
const showMaterialPicker = ref(false)
const materialKeyword = ref('')
let materialRequestId = 0
const persons = ref<{ id: string; name: string }[]>([])
const outsourceOptions = ref<any[]>([])
const membersLoaded = ref(false)
const membersError = ref(false)
const outsourcesLoaded = ref(false)
const outsourcesError = ref(false)
const logResourcesLoading = ref(false)
const logResourcesLoaded = ref(false)
const logStep = ref(0)
const signInRemark = ref('')
const abnormalReason = ref('')
const session = ref<Session>({ status: 'NOT_STARTED' })
const location = ref<SiteLocation>({ name: '', address: '', status: 'PENDING' })
const createEmptyForm = () => ({
  location: '',
  content: '',
  hasOtherParticipants: false,
  personIds: [] as string[],
  needsOutsource: false,
  outsourcingList: [] as any[],
  plate: '',
  mileage: '',
})
const form = ref(createEmptyForm())
const mainSteps = ['签到', '实施日志', '签退']
const logSteps = ['项目信息', '实施记录', '用车与用料']

const projectOptionText = (item: any) => item.name || '未命名分期'
const filteredProjects = computed(() => {
  const keyword = projectKeyword.value.trim().toLowerCase()
  if (!keyword) return projects.value
  return projects.value.filter((item: any) =>
    [item.projectName, item.name].some((value) =>
      String(value || '')
        .toLowerCase()
        .includes(keyword),
    ),
  )
})
const processValue = (item: any) =>
  String(item?.processName ?? item?.workType ?? item?.processType ?? item?.name ?? '')
const processLabelMap = computed<Record<string, string>>(() =>
  Object.fromEntries(workTypeOptions.value.map((item) => [item.value, item.label])),
)
const processDisplayName = (item: any) => {
  const value = processValue(item)
  return processLabelMap.value[value] || value || '未命名工序'
}
const processNames = computed(() => processes.value.map(processDisplayName))
const outsourceNames = computed(() =>
  outsourceOptions.value.map((item: any) => item.unitName || '未命名外协单位'),
)
const mainStep = computed(() =>
  session.value.status === 'COMPLETED'
    ? 3
    : session.value.status === 'LOG_SUBMITTED'
      ? 2
      : ['CHECKED_IN', 'LOG_DRAFT'].includes(session.value.status)
        ? 1
        : 0,
)
const primaryText = computed(() =>
  mainStep.value === 0
    ? hasUnsignedLog.value
      ? '处理上一次流程'
      : '签到并开始实施'
    : mainStep.value === 1 && logStep.value < 2
      ? '下一步'
      : mainStep.value === 1
        ? '提交实施日志'
        : '签退并完成本次实施',
)
const backfillMinTime = computed(() => {
  const value = dayjs(session.value.checkInTime)
  return value.isValid() ? value.valueOf() : dayjs().subtract(30, 'day').valueOf()
})
const remainDaysText = computed(() =>
  project.value.remainDays < 0
    ? `已延期 ${-project.value.remainDays} 天`
    : `${project.value.remainDays ?? 0} 天`,
)
const elapsedText = computed(() => {
  if (!session.value.checkInTime) return '--'
  const end = session.value.checkOutTime ? dayjs(session.value.checkOutTime) : dayjs()
  const minutes = Math.max(1, end.diff(dayjs(session.value.checkInTime), 'minute'))
  return minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
})
const isLocationAbnormal = computed(() =>
  ['OUT_OF_RANGE', 'FAILED', 'NO_SITE'].includes(location.value.status),
)
const isSignInLocationAbnormal = computed(() => location.value.status === 'OUT_OF_RANGE')
const currentUserId = computed(() =>
  String(userStore.userInfo.userid || (userStore.userInfo as any).id || ''),
)
const isSiteLeader = computed(
  () =>
    Boolean(project.value.siteLeaderId) &&
    String(project.value.siteLeaderId) === currentUserId.value,
)
const filteredIssuedMaterials = computed(() => {
  const keyword = materialKeyword.value.toLowerCase()
  if (!keyword) return issuedMaterials.value
  return issuedMaterials.value.filter(
    (item: any) =>
      String(item.materialCode || '')
        .toLowerCase()
        .includes(keyword) ||
      String(item.name || '')
        .toLowerCase()
        .includes(keyword),
  )
})
const allFilteredMaterialsSelected = computed(
  () =>
    filteredIssuedMaterials.value.some(
      (item: any) => item.materialPlanId && Number(item.planQty) > 0 && Number(item.outQty) > 0,
    ) &&
    filteredIssuedMaterials.value
      .filter(
        (item: any) => item.materialPlanId && Number(item.planQty) > 0 && Number(item.outQty) > 0,
      )
      .every((item: any) =>
        selectedMaterials.value.some((selected: any) => String(selected.id) === String(item.id)),
      ),
)
const formatDateTime = (value?: string) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--'
const shortTime = (value?: string) => (value ? dayjs(value).format('HH:mm') : '--')

const processTime = (item: any) => {
  const value = dayjs(item.plannedStartTime)
  return value.isValid() ? value.valueOf() : Number.MAX_SAFE_INTEGER
}
const loadWorkTypeOptions = async () => {
  try {
    const response: any = await http.get('/sys/dict/getDictItems/work_type')
    const rows = Array.isArray(response?.result) ? response.result : []
    workTypeOptions.value = rows
      .map((item: any) => ({
        value: String(item?.value ?? item?.dictValue ?? item?.code ?? ''),
        label: String(item?.text ?? item?.label ?? item?.dictLabel ?? item?.title ?? ''),
      }))
      .filter((item: DictOption) => item.value && item.label)
  } catch (error) {
    workTypeOptions.value = []
    console.warn('加载实施工序字典失败，将保留接口原始值', error)
  }
}
let processStateRequestId = 0
const applySelectedProcess = (index: number) => {
  const currentProcess = processes.value[index]
  processStateRequestId++
  activeProcessStatus.value = ''
  unsignedStatusChecked.value = false
  hasUnsignedLog.value = false
  showIncompleteFlow.value = false
  selectedProcessIndex.value = currentProcess ? index : 0
  project.value = {
    ...project.value,
    currentProcess: currentProcess ? processDisplayName(currentProcess) : '',
    processId: currentProcess?.id || currentProcess?.processId || '',
    siteLeaderId:
      currentProcess?.siteLeaderId || currentProcess?.leaderId || currentProcess?.leader || '',
    siteLeaderName: currentProcess?.siteLeaderName || currentProcess?.leaderName || '',
    processPlan: currentProcess
      ? [currentProcess.plannedStartTime, currentProcess.plannedEndTime].filter(Boolean).join(' ~ ')
      : '',
  }
}
const resetCurrentFlow = () => {
  session.value = { status: 'NOT_STARTED' }
  form.value = createEmptyForm()
  signInPhotos.value = []
  photos.value = []
  signOutPhotos.value = []
  selectedMaterials.value = []
  logStep.value = 0
  signInRemark.value = ''
  abnormalReason.value = ''
  resumingPreviousFlow.value = false
  showBackfill.value = false
  backfillRemark.value = ''
  previousDraft.value = undefined
}
const loadPreviousDraft = async () => {
  if (!project.value.id || !project.value.processId || draftLoading.value)
    return previousDraft.value
  draftLoading.value = true
  try {
    const response: any = await projectApi.signOutDraft(
      String(project.value.id),
      String(project.value.processId),
    )
    previousDraft.value = response?.result ?? response?.data ?? null
    return previousDraft.value
  } catch (error) {
    previousDraft.value = undefined
    toast.error('上一次实施草稿加载失败，可点击继续重试')
    return undefined
  } finally {
    draftLoading.value = false
  }
}
const checkSelectedProcessStatus = async (showPrompt = true) => {
  if (!project.value.id || !project.value.processId) return ''
  const periodId = String(project.value.id)
  const processId = String(project.value.processId)
  const requestId = ++processStateRequestId
  processStatusLoading.value = true
  try {
    const response: any = await projectApi.processStatus(periodId, processId)
    if (requestId !== processStateRequestId) return ''
    const result = response?.result || response?.data || response || {}
    const status = String(result.status || '').toUpperCase()
    activeProcessStatus.value = status
    const unsignedResponse: any = await projectApi.unsignedImplementLogStatus(periodId, processId)
    if (requestId !== processStateRequestId) return ''
    const unsignedResult = unsignedResponse?.result || unsignedResponse?.data || {}
    hasUnsignedLog.value = unsignedResult.hasUnsignedLog === true
    unsignedStatusChecked.value = true
    if (!hasUnsignedLog.value) previousDraft.value = undefined
    showIncompleteFlow.value =
      hasUnsignedLog.value && session.value.status === 'NOT_STARTED' && showPrompt
    return status
  } catch (error) {
    if (requestId !== processStateRequestId) return ''
    activeProcessStatus.value = ''
    unsignedStatusChecked.value = false
    hasUnsignedLog.value = false
    toast.error('工序或未签退状态查询失败，请重新选择工序后再试')
    return ''
  } finally {
    if (requestId === processStateRequestId) processStatusLoading.value = false
  }
}
const onProcess = async (event: any) => {
  resetCurrentFlow()
  applySelectedProcess(Number(event.detail.value))
  await checkSelectedProcessStatus()
}
const normalizeSite = (item: any): ImplementationSite | null => {
  const latitude = Number(item.latitude)
  const longitude = Number(item.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return {
    id: item.id,
    locationName: item.locationName || item.name || item.address || '实施地点',
    description: item.description || item.address || '',
    latitude,
    longitude,
  }
}
const loadCheckInContext = async (preferredProcessId = '') => {
  if (!project.value.id) return
  processesLoading.value = true
  sitesLoading.value = true
  sitesError.value = false
  const [detailResult, processResult, locationResult] = await Promise.allSettled([
    projectApi.detail(project.value.id),
    projectApi.processes(project.value.id),
    projectApi.locations(project.value.id),
    loadWorkTypeOptions(),
  ])
  if (detailResult.status === 'fulfilled') {
    const detail = detailResult.value?.result || detailResult.value
    if (detail && typeof detail === 'object') {
      project.value = { ...project.value, ...normalizeProject(detail), id: project.value.id }
    }
  }
  const processRows = processResult.status === 'fulfilled' ? unwrapRecords(processResult.value) : []
  processes.value = [...processRows].sort(
    (a: any, b: any) =>
      processTime(a) - processTime(b) ||
      Number(a.sortNo ?? Number.MAX_SAFE_INTEGER) - Number(b.sortNo ?? Number.MAX_SAFE_INTEGER),
  )
  const preferredIndex = processes.value.findIndex(
    (item: any) => String(item.id) === String(preferredProcessId),
  )
  applySelectedProcess(preferredIndex >= 0 ? preferredIndex : 0)
  const startDates = processes.value
    .map((item: any) => item.plannedStartTime)
    .filter(Boolean)
    .sort()
  const endDates = processes.value
    .map((item: any) => item.plannedEndTime)
    .filter(Boolean)
    .sort()
  project.value.startDate = startDates[0] || project.value.startDate || ''
  project.value.endDate = endDates[endDates.length - 1] || project.value.endDate || ''
  project.value.remainDays = project.value.endDate
    ? dayjs(project.value.endDate).startOf('day').diff(dayjs().startOf('day'), 'day')
    : 0
  if (locationResult.status === 'fulfilled') {
    implementationSites.value = unwrapRecords(locationResult.value)
      .map(normalizeSite)
      .filter(Boolean) as ImplementationSite[]
  } else {
    implementationSites.value = []
    sitesError.value = true
  }
  processesLoading.value = false
  sitesLoading.value = false
  await checkSelectedProcessStatus()
}
const loadParticipatedProjects = async () => {
  if (projectsLoading.value) return
  projectsLoading.value = true
  projectsError.value = false
  try {
    const response = await projectApi.participatedProjects()
    const uniqueProjects = new Map<string, any>()
    unwrapRecords(response)
      .map(normalizeProject)
      .forEach((item: any) => {
        if (item.id) uniqueProjects.set(String(item.id), item)
      })
    projects.value = [...uniqueProjects.values()]
  } catch (error) {
    projects.value = []
    projectsError.value = true
  } finally {
    projectsLoading.value = false
  }
}
const openProjectPicker = async () => {
  showProjectPicker.value = true
  if (!projects.value.length && !projectsLoading.value) await loadParticipatedProjects()
}
const resetLogResources = () => {
  materialRequestId++
  issuedMaterials.value = []
  selectedMaterials.value = []
  materialsError.value = false
  materialsLoading.value = false
  persons.value = []
  membersLoaded.value = false
  membersError.value = false
  outsourceOptions.value = []
  outsourcesLoaded.value = false
  outsourcesError.value = false
  logResourcesLoaded.value = false
}
const selectProject = async (item: any) => {
  if (String(project.value.id) === String(item.id) && !sitesError.value) {
    showProjectPicker.value = false
    return
  }
  resetCurrentFlow()
  project.value = { ...item }
  processes.value = []
  implementationSites.value = []
  resetLogResources()
  location.value = { name: '正在加载实施地点…', address: '请稍候', status: 'PENDING' }
  showProjectPicker.value = false
  await loadCheckInContext()
  getLocation()
}
const setOtherParticipants = (value: boolean) => {
  if (!isSiteLeader.value) return toast.warning('仅当前工序现场负责人可选择参与人员')
  form.value.hasOtherParticipants = value
  if (!value) form.value.personIds = []
}
const togglePerson = (id: string) => {
  if (!isSiteLeader.value) return toast.warning('仅当前工序现场负责人可选择参与人员')
  const index = form.value.personIds.indexOf(id)
  index >= 0 ? form.value.personIds.splice(index, 1) : form.value.personIds.push(id)
}
const setNeedsOutsource = (value: boolean) => {
  if (!isSiteLeader.value) return toast.warning('仅当前工序现场负责人可填写外协信息')
  form.value.needsOutsource = value
  if (!value) form.value.outsourcingList = []
  else if (!form.value.outsourcingList.length && outsourceOptions.value.length) addOutsource()
}
const outsourceIndex = (unitId: string) => {
  const index = outsourceOptions.value.findIndex(
    (item: any) => String(item.unitId) === String(unitId),
  )
  return index >= 0 ? index : 0
}
const onOutsourceUnit = (row: any, event: any) => {
  if (!isSiteLeader.value) return toast.warning('仅当前工序现场负责人可填写外协信息')
  const selected = outsourceOptions.value[Number(event.detail.value)]
  if (!selected) return
  Object.assign(row, {
    outsourceMemberId: selected.outsourceMemberId,
    unitId: selected.unitId,
    unitName: selected.unitName,
    plannedHeadcount: selected.headcount,
    plannedWorkHours: selected.workHours,
  })
}
let outsourceSeed = 0
const addOutsource = () => {
  if (!isSiteLeader.value) return toast.warning('仅当前工序现场负责人可填写外协信息')
  form.value.outsourcingList.push({
    key: ++outsourceSeed,
    outsourceMemberId: '',
    unitId: '',
    unitName: '',
    headcount: '',
    workHours: '',
    plannedHeadcount: 0,
    plannedWorkHours: 0,
  })
}
const removeOutsource = (key: number) => {
  if (!isSiteLeader.value) return toast.warning('仅当前工序现场负责人可填写外协信息')
  form.value.outsourcingList = form.value.outsourcingList.filter((item: any) => item.key !== key)
}
const choosePhotos = (target: 'signIn' | 'log' | 'signOut') => {
  const targetPhotos =
    target === 'signIn' ? signInPhotos : target === 'signOut' ? signOutPhotos : photos
  const remaining = 3 - targetPhotos.value.length
  if (remaining <= 0) return
  uni.chooseImage({
    count: remaining,
    success: (result) => targetPhotos.value.push(...result.tempFilePaths),
  })
}
const addSignInPhoto = () => choosePhotos('signIn')
const addPhoto = () => choosePhotos('log')
const addSignOutPhoto = () => choosePhotos('signOut')

const distanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
const isH5LocationBlockedBySecurity = () => {
  // #ifdef H5
  if (typeof window !== 'undefined') {
    if (typeof window.isSecureContext === 'boolean') return !window.isSecureContext
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
    return window.location.protocol !== 'https:' && !isLocalhost
  }
  // #endif
  return false
}
const locationFailure = (error: any): SiteLocation => {
  const code = Number(error?.code ?? error?.errCode)
  const detail = String(error?.errMsg || error?.message || '').toLowerCase()
  if (code === 1 || /permission|denied|authorize|auth deny/.test(detail)) {
    return {
      name: '定位权限未开启',
      address: '请允许当前网页使用位置，并确认系统位置服务已开启',
      status: 'FAILED',
    }
  }
  if (code === 2 || /unavailable|position/.test(detail)) {
    return {
      name: '当前设备暂时无法定位',
      address: '请检查系统位置服务；电脑端可切换 Edge 后重新定位',
      status: 'FAILED',
    }
  }
  if (code === 3 || /timeout/.test(detail)) {
    return {
      name: '定位超时',
      address: '请保持定位权限开启后重试；电脑端可切换 Edge',
      status: 'FAILED',
    }
  }
  return {
    name: '定位失败',
    address: '请检查浏览器与系统定位权限后重新定位',
    status: 'FAILED',
  }
}
const applyLocation = (latitude: number, longitude: number, simulated = false) => {
  if (!implementationSites.value.length) {
    location.value = {
      name: '项目尚未配置实施地点',
      address: '请先在项目实施计划中配置地点后再签到',
      status: 'NO_SITE',
    }
    return
  }
  const nearest = implementationSites.value
    .map((site) => ({
      site,
      distance: distanceInMeters(latitude, longitude, site.latitude, site.longitude),
    }))
    .sort((a, b) => a.distance - b.distance)[0]
  const roundedDistance = Math.round(nearest.distance)
  const status: LocationStatus = nearest.distance <= 200 ? 'NORMAL' : 'OUT_OF_RANGE'
  location.value = {
    latitude,
    longitude,
    status,
    matchedSiteId: nearest.site.id,
    matchedSiteName: nearest.site.locationName,
    distance: roundedDistance,
    name:
      status === 'NORMAL'
        ? `已进入“${nearest.site.locationName}”范围`
        : `距最近地点“${nearest.site.locationName}”约 ${roundedDistance} 米`,
    address: simulated
      ? `${nearest.site.description || nearest.site.locationName}（Mock 定位）`
      : `经度 ${longitude.toFixed(6)}，纬度 ${latitude.toFixed(6)}`,
  }
}
const getLocation = () => {
  if (!project.value.id || locating.value) return
  if (sitesLoading.value) return
  if (sitesError.value) {
    location.value = { name: '实施地点加载失败', address: '请重新选择项目后再试', status: 'FAILED' }
    return
  }
  if (!implementationSites.value.length) {
    location.value = {
      name: '项目尚未配置实施地点',
      address: '请先在项目实施计划中配置地点后再签到',
      status: 'NO_SITE',
    }
    return
  }
  if (isH5LocationBlockedBySecurity()) {
    location.value = {
      name: '当前访问地址无法定位',
      address: '局域网访问请使用 HTTPS 地址后重新定位',
      status: 'FAILED',
    }
    return
  }
  locating.value = true
  location.value = {
    ...location.value,
    name: '正在获取位置…',
    address: '请保持定位权限开启',
    status: 'PENDING',
  }
  let settled = false
  const useMockLocation = () => {
    const mockSite = implementationSites.value[0]
    applyLocation(mockSite.latitude, mockSite.longitude, true)
  }
  const slowTimer = setTimeout(() => {
    if (settled) return
    location.value = {
      ...location.value,
      name: '定位响应较慢，仍在尝试…',
      address: '请保持网页打开并确认系统定位权限已开启',
      status: 'PENDING',
    }
  }, 5000)
  const timeoutTimer = setTimeout(() => {
    if (settled) return
    settled = true
    clearTimeout(slowTimer)
    if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true') useMockLocation()
    else location.value = locationFailure({ code: 3 })
    locating.value = false
  }, 20000)
  uni.getLocation({
    type: 'gcj02',
    success: (result) => {
      if (settled) return
      settled = true
      clearTimeout(slowTimer)
      clearTimeout(timeoutTimer)
      applyLocation(result.latitude, result.longitude)
    },
    fail: (error) => {
      if (settled) return
      settled = true
      clearTimeout(slowTimer)
      clearTimeout(timeoutTimer)
      console.warn('[implementLog] 获取当前位置失败', error)
      if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true') useMockLocation()
      else location.value = locationFailure(error)
    },
    complete: () => {
      if (settled) locating.value = false
    },
  })
}

const parsePhotoList = (value: unknown) =>
  Array.isArray(value)
    ? value.map(String).filter(Boolean)
    : String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)

const restoreDraft = (draft: any) => {
  if (!draft) return
  const participantIds = String(draft.internalParticipantIds || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const outsourcingList = (draft.outsources || draft.outsourcingList || []).map((item: any) => {
    const option = outsourceOptions.value.find(
      (candidate: any) =>
        String(candidate.outsourceMemberId) === String(item.outsourceMemberId || item.id),
    )
    return {
      key: ++outsourceSeed,
      outsourceMemberId: String(item.outsourceMemberId || item.id || ''),
      unitId: option?.unitId || item.unitId || '',
      unitName: option?.unitName || item.unitName || '计划外协单位',
      headcount: item.headcount ?? '',
      workHours: item.workHours ?? '',
      plannedHeadcount: option?.headcount || 0,
      plannedWorkHours: option?.workHours || 0,
      remark: item.remark || '',
    }
  })
  form.value = {
    ...createEmptyForm(),
    location: draft.implementLocationName || draft.location || '',
    content: draft.workContent || draft.content || '',
    hasOtherParticipants: participantIds.length > 0,
    personIds: participantIds,
    needsOutsource: outsourcingList.length > 0,
    outsourcingList,
    plate: draft.vehicleNo || '',
    mileage: draft.mileage ?? '',
  }
  outsourceSeed = Math.max(
    outsourceSeed,
    ...form.value.outsourcingList.map((item: any) => Number(item.key) || 0),
  )
  signInPhotos.value = parsePhotoList(draft.signInPhotos)
  photos.value = parsePhotoList(draft.photos)
  const issuedMap = new Map<string, any>()
  issuedMaterials.value.forEach((item: any) => {
    issuedMap.set(String(item.id), item)
    if (item.materialPlanId) issuedMap.set(String(item.materialPlanId), item)
  })
  selectedMaterials.value = (draft.materials || [])
    .map((item: any) => ({
      source: issuedMap.get(String(item.materialPlanId || item.materialId || item.id)),
      qty: item.usedQty ?? item.qty,
    }))
    .filter((item: any) => item.source)
    .map((item: any) => ({ ...item.source, qty: item.qty }))
}
const loadProjectMaterials = async (projectId: string) => {
  const currentProject = projects.value.find((item: any) => item.id === projectId) || project.value
  const projectNo = currentProject?.periodNo || currentProject?.projectNo || currentProject?.xmNo
  if (!projectNo) return
  const requestId = ++materialRequestId
  materialsLoading.value = true
  materialsError.value = false
  try {
    const [applyRes, planRes]: any[] = await Promise.all([
      http.get('/stock/apply/list', {
        projectNo,
        applyType: 'OUT',
        pageNo: 1,
        pageSize: 1000,
      }),
      projectApi.materialPlans(projectId),
    ])
    const applies = unwrapRecords(applyRes).filter(
      (item: any) =>
        String(item.projectNo || '') === String(projectNo) &&
        (item.applyType === 'OUT' || item.bizType === 'PICK'),
    )
    const itemResponses: any[] = await Promise.all(
      applies.map((item: any) =>
        http.get('/stock/apply/items', { applyId: item.id, pageNo: 1, pageSize: 1000 }),
      ),
    )
    if (requestId !== materialRequestId) return
    const planMetaMap = new Map<string, { materialPlanId: string; planQty: number }>()
    unwrapRecords(planRes).forEach((item: any) => {
      const materialId = String(item.materialId || item.id || '')
      if (!materialId) return
      const old = planMetaMap.get(materialId)
      planMetaMap.set(materialId, {
        materialPlanId: old?.materialPlanId || String(item.id || item.materialPlanId || ''),
        planQty: Number(old?.planQty || 0) + Number(item.plannedQty ?? item.planQty ?? 0),
      })
    })
    const materialMap = new Map<string, any>()
    itemResponses.flatMap(unwrapRecords).forEach((item: any) => {
      const outQty = Number(item.executedQty ?? item.outQty ?? 0)
      if (!item.materialId || outQty <= 0) return
      const old = materialMap.get(item.materialId)
      const plan = planMetaMap.get(String(item.materialId))
      materialMap.set(item.materialId, {
        id: item.materialId,
        materialPlanId: plan?.materialPlanId || '',
        materialCode: item.materialCode || item.code || old?.materialCode || '',
        name: item.materialName || old?.name || '未命名物料',
        spec: item.model || item.spec || old?.spec || '',
        unit: item.unitName || item.unit || old?.unit || '',
        outQty: Number(old?.outQty || 0) + outQty,
        planQty: plan?.planQty || 0,
      })
    })
    issuedMaterials.value = [...materialMap.values()]
    const selectedQty = new Map(selectedMaterials.value.map((item: any) => [item.id, item.qty]))
    selectedMaterials.value = issuedMaterials.value
      .filter((item: any) => selectedQty.has(item.id))
      .map((item: any) => ({ ...item, qty: selectedQty.get(item.id) }))
  } catch (error) {
    if (requestId !== materialRequestId) return
    issuedMaterials.value = []
    materialsError.value = true
  } finally {
    if (requestId === materialRequestId) materialsLoading.value = false
  }
}
const isMaterialSelected = (id: string) =>
  selectedMaterials.value.some((item: any) => item.id === id)
const toggleMaterial = (material: any) => {
  const index = selectedMaterials.value.findIndex((item: any) => item.id === material.id)
  if (index >= 0) selectedMaterials.value.splice(index, 1)
  else {
    if (Number(material.planQty) <= 0) {
      toast.warning(`${material.name}未配置计划数量，不能记录使用量`)
      return
    }
    selectedMaterials.value.push({
      ...material,
      qty: Math.min(1, Number(material.outQty), Number(material.planQty)),
    })
  }
}
const toggleSelectAllMaterials = () => {
  if (!filteredIssuedMaterials.value.length) return
  const visibleIds = new Set(filteredIssuedMaterials.value.map((item: any) => String(item.id)))
  if (allFilteredMaterialsSelected.value) {
    selectedMaterials.value = selectedMaterials.value.filter(
      (item: any) => !visibleIds.has(String(item.id)),
    )
    return
  }
  const selectedIds = new Set(selectedMaterials.value.map((item: any) => String(item.id)))
  filteredIssuedMaterials.value.forEach((material: any) => {
    if (selectedIds.has(String(material.id))) return
    if (!material.materialPlanId || Number(material.planQty) <= 0 || Number(material.outQty) <= 0)
      return
    selectedMaterials.value.push({
      ...material,
      qty: Math.min(1, Number(material.outQty), Number(material.planQty)),
    })
  })
}
const removeMaterial = (id: string) => {
  selectedMaterials.value = selectedMaterials.value.filter((item: any) => item.id !== id)
}
const openMaterialPicker = () => {
  if (materialsLoading.value) return
  if (materialsError.value) return loadProjectMaterials(project.value.id)
  showMaterialPicker.value = true
}
const loadMembers = async () => {
  if (membersLoaded.value) return
  membersError.value = false
  try {
    const response = await projectApi.members(project.value.id)
    const currentUserId = String(userStore.userInfo.userid || '')
    const uniqueMembers = new Map<string, { id: string; name: string }>()
    unwrapRecords(response)
      .filter((item: any) => item.inviteStatus == null || Number(item.inviteStatus) === 1)
      .forEach((item: any) => {
        const id = String(item.userId || item.memberId || item.id || '')
        const name = item.userName || item.memberName || item.realname
        if (id && name && id !== currentUserId) uniqueMembers.set(id, { id, name })
      })
    persons.value = [...uniqueMembers.values()]
    membersLoaded.value = true
  } catch (error) {
    persons.value = []
    membersError.value = true
  }
}
const loadOutsources = async () => {
  if (outsourcesLoaded.value) return
  outsourcesError.value = false
  try {
    const response = await projectApi.outsources(project.value.id)
    outsourceOptions.value = unwrapRecords(response).map((item: any) => ({
      outsourceMemberId: String(item.id || item.outsourceMemberId || ''),
      unitId: String(item.unitId || ''),
      unitName: item.unitName || '未命名外协单位',
      headcount: Number(item.headcount || 0),
      workHours: Number(item.workHours || 0),
    }))
    outsourcesLoaded.value = true
  } catch (error) {
    outsourceOptions.value = []
    outsourcesError.value = true
  }
}
const loadLogResources = async () => {
  if (!project.value.id || logResourcesLoading.value || logResourcesLoaded.value) return
  logResourcesLoading.value = true
  try {
    await Promise.allSettled([
      loadMembers(),
      loadOutsources(),
      loadProjectMaterials(project.value.id),
    ])
    logResourcesLoaded.value = true
  } finally {
    logResourcesLoading.value = false
  }
}
const resumePreviousFlow = async () => {
  if (draftLoading.value || !project.value.id || !project.value.processId) return
  draftLoading.value = true
  try {
    await loadLogResources()
    let draft = previousDraft.value
    if (draft === undefined) {
      draftLoading.value = false
      draft = await loadPreviousDraft()
      draftLoading.value = true
    }
    if (!draft) {
      hasUnsignedLog.value = false
      unsignedStatusChecked.value = true
      showIncompleteFlow.value = false
      toast.warning('未找到待签退记录，请重新选择工序后再试')
      return
    }
    session.value = {
      periodId: String(project.value.id),
      project: project.value,
      processId: String(project.value.processId),
      status: 'LOG_DRAFT',
      checkInTime: draft.signInTime || '',
      checkInType: draft.signInType,
      signInRemark: draft.signInRemark || '',
      signInPhotos: parsePhotoList(draft.signInPhotos),
      logStep: 0,
      logData: draft,
    }
    restoreDraft(draft)
    resumingPreviousFlow.value = true
    showIncompleteFlow.value = false
    logStep.value = 0
    getLocation()
    toast.success(draft ? '已恢复上一次实施内容' : '已进入上一次未完成流程')
  } catch (error) {
    toast.error('上一次实施流程加载失败，请稍后重试')
  } finally {
    draftLoading.value = false
  }
}
const load = async () => {
  loading.value = true
  try {
    await loadParticipatedProjects()
    project.value = projects.value.find((item: any) => item.id === routeProjectId.value) || {}
    if (project.value.id) {
      await loadCheckInContext()
    }
    if (project.value.id) getLocation()
  } catch (error) {
    toast.error('实施信息加载失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

const logPayload = () => ({
  ...form.value,
  photos: photos.value,
  persons: persons.value.filter((item) => form.value.personIds.includes(item.id)),
  materials: selectedMaterials.value.map((item) => ({
    id: item.id,
    materialPlanId: item.materialPlanId,
    name: item.name,
    qty: Number(item.qty),
    unit: item.unit,
    planQty: Number(item.planQty),
    outQty: Number(item.outQty),
  })),
})
const checkIn = async () => {
  if (!project.value.id) return toast.warning('请选择实施项目')
  if (!project.value.processId) return toast.warning('当前项目暂无可签到工序')
  if (processStatusLoading.value) return toast.warning('正在查询工序状态，请稍候')
  const processStatus =
    activeProcessStatus.value && unsignedStatusChecked.value
      ? activeProcessStatus.value
      : await checkSelectedProcessStatus(false)
  if (hasUnsignedLog.value) {
    showIncompleteFlow.value = true
    return
  }
  if (processStatus === 'COMPLETED') return toast.warning('当前工序已完成，不能再次签到')
  if (!['NOT_STARTED', 'IN_PROGRESS'].includes(processStatus))
    return toast.warning('未能确认工序状态，请重新选择工序后再试')
  if (location.value.status === 'NO_SITE') return toast.warning('项目尚未配置实施地点')
  if (location.value.status === 'PENDING') return toast.warning('请先获取当前位置')
  if (location.value.status === 'FAILED') return toast.warning('定位失败，请重新定位后签到')
  if (isSignInLocationAbnormal.value && !signInRemark.value.trim())
    return toast.warning('请填写签到位置异常原因')
  if (isSignInLocationAbnormal.value && !signInPhotos.value.length)
    return toast.warning('请上传签到位置异常的现场照片')
  submitting.value = true
  try {
    const checkInTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const uploadedSignInPhotos = isSignInLocationAbnormal.value
      ? await Promise.all(signInPhotos.value.map(uploadPhoto))
      : []
    signInPhotos.value = uploadedSignInPhotos
    const response: any = await projectApi.signInImplementLog({
      periodId: project.value.id,
      processId: project.value.processId,
      signInLng: Number(location.value.longitude),
      signInLat: Number(location.value.latitude),
      signInRemark: isSignInLocationAbnormal.value
        ? signInRemark.value.trim() || undefined
        : undefined,
      signInPhotos: isSignInLocationAbnormal.value
        ? uploadedSignInPhotos.join(',') || undefined
        : undefined,
    })
    const result = response?.result || response?.data || {}
    const checkInType = String(result.signInType || '').toUpperCase()
    session.value = {
      periodId: project.value.id,
      project: project.value,
      processId: project.value.processId,
      status: 'CHECKED_IN',
      checkInTime: result.signInTime || checkInTime,
      checkInLocation: location.value,
      checkInType: checkInType === 'EXCEPTION' ? 'EXCEPTION' : 'NORMAL',
      signInRemark: isSignInLocationAbnormal.value
        ? result.signInRemark || signInRemark.value.trim()
        : '',
      signInPhotos: parsePhotoList(result.signInPhotos || uploadedSignInPhotos),
    }
    activeProcessStatus.value = 'IN_PROGRESS'
    hasUnsignedLog.value = true
    unsignedStatusChecked.value = true
    logStep.value = 0
    toast.success('签到成功，请填写本次实施日志')
    loadLogResources()
  } catch (error) {
    toast.error('签到失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}
const validateMaterialUsage = () => {
  const invalidMaterial = selectedMaterials.value.find(
    (item: any) =>
      Number(item.qty) <= 0 ||
      !item.materialPlanId ||
      Number(item.qty) > Number(item.outQty) ||
      Number(item.qty) > Number(item.planQty),
  )
  if (!invalidMaterial) return true
  toast.warning(
    `${invalidMaterial.name}的使用数量应大于 0，且不能超过计划数量 ${invalidMaterial.planQty}${invalidMaterial.unit || ''}和已出库数量 ${invalidMaterial.outQty}${invalidMaterial.unit || ''}`,
  )
  return false
}
const validateRecord = () => {
  if (!form.value.location.trim()) {
    toast.warning('请填写具体实施位置')
    return false
  }
  if (!form.value.content.trim()) {
    toast.warning('请填写本次实施内容')
    return false
  }
  if (form.value.hasOtherParticipants && !form.value.personIds.length) {
    toast.warning('请选择本次日志的其他参与人员')
    return false
  }
  if (form.value.needsOutsource) {
    if (!form.value.outsourcingList.length) {
      toast.warning('请至少添加一条当天外协记录')
      return false
    }
    const invalidOutsource = form.value.outsourcingList.find(
      (item: any) =>
        !item.outsourceMemberId ||
        !item.unitId ||
        Number(item.headcount) <= 0 ||
        Number(item.workHours) <= 0,
    )
    if (invalidOutsource) {
      toast.warning('请选择外协单位，并填写大于 0 的人数和工时')
      return false
    }
    const unitIds = form.value.outsourcingList.map((item: any) => String(item.unitId))
    if (new Set(unitIds).size !== unitIds.length) {
      toast.warning('同一个外协单位当天只需添加一次')
      return false
    }
  }
  return validateMaterialUsage()
}
const saveDraft = async (silent: boolean) => {
  if (!session.value.periodId || !session.value.processId || submitting.value) return false
  if (!silent && !validateMaterialUsage()) return false
  submitting.value = true
  try {
    const data = logPayload()
    const uploadedPhotos = await Promise.all((data.photos || []).map(uploadPhoto))
    photos.value = uploadedPhotos
    const outsources = data.needsOutsource
      ? data.outsourcingList
          .filter(
            (item: any) =>
              item.outsourceMemberId &&
              String(item.headcount).trim() &&
              String(item.workHours).trim(),
          )
          .map((item: any) => ({
            outsourceMemberId: item.outsourceMemberId,
            headcount: Number(item.headcount),
            workHours: Number(item.workHours),
            remark: item.remark || undefined,
          }))
      : []
    const draftPayload: Record<string, any> = {
      periodId: session.value.periodId,
      processId: session.value.processId,
      implementLocationName: data.location.trim() || undefined,
      workContent: data.content,
      photos: uploadedPhotos.join(','),
    }
    const internalParticipantIds = data.hasOtherParticipants ? data.personIds.join(',') : ''
    const materials = data.materials.map((item: any) => ({
      materialPlanId: item.materialPlanId,
      usedQty: Number(item.qty),
    }))
    if (internalParticipantIds) draftPayload.internalParticipantIds = internalParticipantIds
    if (materials.length) draftPayload.materials = materials
    if (outsources.length) draftPayload.outsources = outsources
    if (data.plate.trim()) draftPayload.vehicleNo = data.plate.trim()
    if (data.plate.trim() && String(data.mileage).trim())
      draftPayload.mileage = Number(data.mileage)
    await projectApi.saveSignOutDraft(draftPayload)
    session.value = {
      ...session.value,
      status: session.value.status === 'LOG_SUBMITTED' ? 'LOG_SUBMITTED' : 'LOG_DRAFT',
      logStep: logStep.value,
      logData: { ...data, photos: uploadedPhotos },
    }
    if (!silent) toast.success('草稿已保存')
    return true
  } catch (error) {
    toast.error('草稿保存失败，请稍后重试')
    return false
  } finally {
    submitting.value = false
  }
}
const submitLog = async () => {
  if (!validateRecord() || submitting.value) return
  if (form.value.plate && Number(form.value.mileage) <= 0)
    return toast.warning('使用车辆后请填写行驶公里数')
  const saved = await saveDraft(true)
  if (!saved) return
  session.value = { ...session.value, status: 'LOG_SUBMITTED', logStep: 2 }
  location.value = { ...location.value, name: '', address: '', status: 'PENDING' }
  getLocation()
  toast.success('日志已保存，下一步请完成签退')
}

const uploadPhoto = async (filePath: string) => {
  if (/^https?:\/\//.test(filePath)) return filePath
  const response: any = await http.upload('/sys/common/upload', {
    filePath,
    name: 'file',
    formData: { biz: String(project.value.id || 'project') },
  })
  const data = response?.data || {}
  if (![0, 200].includes(Number(data.code))) throw new Error(data.message || '照片上传失败')
  return data.message as string
}

const buildSignOutPayload = async (signOutRemark?: string, signOutTime?: string) => {
  const uploadedSignOutPhotos = isLocationAbnormal.value
    ? await Promise.all(signOutPhotos.value.map(uploadPhoto))
    : []
  signOutPhotos.value = uploadedSignOutPhotos
  const longitude = Number(location.value.longitude)
  const latitude = Number(location.value.latitude)
  return {
    periodId: project.value.id,
    processId: session.value.processId,
    ...(signOutTime ? { signOutTime } : {}),
    ...(Number.isFinite(longitude) ? { signOutLng: longitude } : {}),
    ...(Number.isFinite(latitude) ? { signOutLat: latitude } : {}),
    implementLocationName: form.value.location || undefined,
    signOutRemark: signOutRemark || undefined,
    signOutPhotos: isLocationAbnormal.value
      ? uploadedSignOutPhotos.join(',') || undefined
      : undefined,
  }
}
const finishCurrentFlow = (checkOutTime: string, signOutType?: string) => {
  const normalizedSignOutType = String(signOutType || '').toUpperCase()
  const checkOutLocationStatus: LocationStatus =
    normalizedSignOutType === 'NORMAL'
      ? 'NORMAL'
      : normalizedSignOutType === 'EXCEPTION'
        ? 'OUT_OF_RANGE'
        : location.value.status
  const start = dayjs(session.value.checkInTime)
  const end = dayjs(checkOutTime)
  const minutes = start.isValid() && end.isValid() ? Math.max(1, end.diff(start, 'minute')) : 0
  const duration =
    minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
  session.value = {
    ...session.value,
    status: 'COMPLETED',
    checkOutTime,
    checkOutLocation: location.value,
    checkOutLocationStatus,
    abnormalReason: abnormalReason.value,
    duration,
  }
  hasUnsignedLog.value = false
  unsignedStatusChecked.value = true
  resumingPreviousFlow.value = false
}
const checkOut = async () => {
  if (location.value.status === 'PENDING') return toast.warning('请先获取签退位置')
  if (isLocationAbnormal.value && !abnormalReason.value.trim())
    return toast.warning('请填写位置异常原因')
  if (isLocationAbnormal.value && !signOutPhotos.value.length)
    return toast.warning('请上传签退位置异常的现场照片')
  if (!validateRecord()) return
  const saved = await saveDraft(true)
  if (!saved) return
  submitting.value = true
  try {
    const payload = await buildSignOutPayload(
      isLocationAbnormal.value ? abnormalReason.value.trim() : undefined,
    )
    const response: any = await projectApi.signOutImplementLog(payload)
    const result = response?.result || response?.data || {}
    finishCurrentFlow(
      result.signOutTime || dayjs().format('YYYY-MM-DD HH:mm:ss'),
      result.signOutType,
    )
    toast.success('签退成功，本次实施已闭环')
  } catch (error) {
    toast.error('签退失败，实施日志尚未提交，请稍后重试')
  } finally {
    submitting.value = false
  }
}
const openBackfill = () => {
  backfillMaxTime.value = Date.now()
  backfillTime.value = backfillMaxTime.value
  backfillRemark.value = ''
  showBackfill.value = true
}
const submitBackfill = async () => {
  if (submitting.value) return
  const selectedTime = dayjs(backfillTime.value)
  const signInTime = dayjs(session.value.checkInTime)
  if (!selectedTime.isValid()) return toast.warning('请选择实际签退时间')
  if (signInTime.isValid() && selectedTime.isBefore(signInTime))
    return toast.warning('实际签退时间不能早于签到时间')
  if (selectedTime.isAfter(dayjs())) return toast.warning('实际签退时间不能晚于当前时间')
  if (!backfillRemark.value.trim()) return toast.warning('请填写未及时签退的原因')
  if (isLocationAbnormal.value && !abnormalReason.value.trim())
    return toast.warning('请填写位置异常原因')
  if (isLocationAbnormal.value && !signOutPhotos.value.length)
    return toast.warning('请上传签退位置异常的现场照片')
  if (!validateRecord()) return
  const signOutTime = selectedTime.format('YYYY-MM-DD HH:mm:ss')
  const saved = await saveDraft(true)
  if (!saved) return
  submitting.value = true
  try {
    const signOutRemark = isLocationAbnormal.value
      ? `${backfillRemark.value.trim()}；位置异常：${abnormalReason.value.trim()}`
      : backfillRemark.value.trim()
    const payload = await buildSignOutPayload(signOutRemark, signOutTime)
    const response: any = await projectApi.backfillSignOutImplementLog(payload)
    const result = response?.result || response?.data || {}
    showBackfill.value = false
    finishCurrentFlow(result.signOutTime || signOutTime, result.signOutType)
    toast.success('补签退成功，上一次实施流程已完成')
  } catch (error) {
    toast.error('补签退失败，请核对时间和原因后重试')
  } finally {
    submitting.value = false
  }
}
const primaryAction = async () => {
  if (submitting.value || locating.value) return
  if (mainStep.value === 0 && hasUnsignedLog.value) {
    showIncompleteFlow.value = true
    return
  }
  if (mainStep.value === 0) return checkIn()
  if (mainStep.value === 1 && logStep.value === 0) return logStep.value++
  if (mainStep.value === 1 && logStep.value === 1) {
    if (validateRecord()) {
      const saved = await saveDraft(true)
      if (saved) logStep.value++
    }
    return
  }
  if (mainStep.value === 1) return submitLog()
  return checkOut()
}
const returnToImplementationLog = () => {
  session.value = { ...session.value, status: 'LOG_DRAFT' }
  logStep.value = 1
}
const showLogDetail = () => {
  const data = session.value.logData || form.value
  const personText = (data.persons || []).map((item: any) => item.name || item).join('、') || '无'
  const outsourceText =
    (data.outsourcingList || [])
      .map((item: any) => `${item.unitName} ${item.headcount}人/${item.workHours}小时`)
      .join('；') || '无'
  const materialText =
    (data.materials || [])
      .map((item: any) => `${item.name} ${item.qty}${item.unit || ''}`)
      .join('；') || '无'
  message.alert({
    title: '实施日志',
    msg: `实施位置：${data.location || '--'}\n实施内容：${data.content || '--'}\n其他参与人员：${personText}\n当天外协：${outsourceText}\n车辆：${data.plate || '无'}${data.plate ? ` / ${data.mileage || 0}km` : ''}\n本次用料：${materialText}`,
  })
}
const backToProject = () =>
  project.value.id
    ? uni.redirectTo({ url: `/pages/ops/projectDetail?id=${project.value.id}` })
    : uni.navigateBack()
onLoad((query) => {
  routeProjectId.value = query?.projectId || query?.id || ''
  load()
})
</script>

<style lang="scss" scoped>
.implementation-layout {
  /* #ifdef H5 */
  height: calc(100vh - var(--window-top));
  /* #endif */
}
.page {
  min-height: 0;
  flex: 1;
}
.steps {
  display: flex;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #ededed;
}
.step {
  display: flex;
  flex: 1;
  gap: 5px;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #666;
}
.step__dot {
  display: flex;
  width: 20px;
  height: 20px;
  background: #ededed;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
}
.step.on {
  color: #176ac7;
  font-weight: 600;
}
.step.on .step__dot {
  color: #fff;
  background: #2f86ff;
}
.step.done {
  color: #267b54;
}
.step.done .step__dot {
  color: #fff;
  background: #35a66f;
}
.session-strip {
  display: flex;
  padding: 12px 14px;
  margin: 12px 12px 0;
  color: #163d68;
  background: #eaf4ff;
  border-radius: 12px;
  align-items: center;
  justify-content: space-between;
}
.session-strip__title {
  font-size: 15px;
  font-weight: 650;
}
.session-strip__meta {
  max-width: 210px;
  margin-top: 3px;
  overflow: hidden;
  font-size: 12px;
  color: #456785;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-strip__time {
  display: flex;
  font-size: 11px;
  color: #456785;
  text-align: right;
  flex-direction: column;
  gap: 3px;
}
.sub-steps {
  display: flex;
  padding: 14px 12px 4px;
  gap: 6px;
}
.sub-step {
  padding: 6px 3px;
  font-size: 11px;
  color: #666;
  text-align: center;
  background: #eee;
  border-radius: 6px;
  flex: 1;
}
.sub-step.on {
  color: #176ac7;
  font-weight: 600;
  background: #eaf4ff;
}
.sub-step.done {
  color: #267b54;
  background: #edf8f2;
}
.row,
.form-row {
  display: flex;
  padding: 11px 0;
  border-bottom: 1px solid #f0f0f0;
  align-items: center;
}
.row:last-child,
.form-row:last-child {
  border-bottom: 0;
}
.top {
  align-items: flex-start;
}
.label {
  width: 88px;
  font-size: 13px;
  color: #555;
  flex: none;
}
.val {
  font-size: 13px;
  line-height: 1.55;
  color: #222;
  flex: 1;
}
.warn {
  color: #b84141;
  font-weight: 600;
}
.input {
  min-width: 0;
  font-size: 14px;
  color: #222;
  flex: 1;
}
.textarea {
  height: 92px;
  padding: 0;
  font-size: 14px;
  line-height: 1.55;
  color: #222;
  flex: 1;
}
.unit {
  margin-left: 8px;
  font-size: 12px;
  color: #666;
}
.picker-value {
  min-width: 190px;
  font-size: 14px;
  color: #222;
}
.picker-value--select {
  min-width: 0;
  line-height: 1.5;
  color: #176ac7;
  flex: 1;
}
.select-picker {
  min-width: 0;
  flex: 1;
}
.select-control {
  display: flex;
  gap: 8px;
  align-items: center;
}
.select-control__text {
  min-width: 0;
  word-break: break-word;
  flex: 1;
}
.placeholder {
  color: #767676;
}
.flow-tip {
  padding: 0 20px 20px;
  font-size: 12px;
  line-height: 1.6;
  color: #666;
  text-align: center;
}
.flow-tip.strong {
  color: #795719;
}
.recovery-notice {
  display: flex;
  padding: 11px 13px;
  margin: 12px 12px 0;
  font-size: 12px;
  line-height: 1.55;
  color: #70470e;
  background: #fff5df;
  border-radius: 12px;
  align-items: flex-start;
  gap: 8px;
}
.recovery-notice text {
  min-width: 0;
  flex: 1;
}
.recovery-popup {
  padding: 24px 18px calc(18px + env(safe-area-inset-bottom));
  text-align: center;
  background: #fff;
}
.recovery-popup__icon {
  display: flex;
  width: 48px;
  height: 48px;
  margin: 0 auto;
  background: #fff5df;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
}
.recovery-popup__title {
  margin-top: 14px;
  font-size: 18px;
  font-weight: 700;
  color: #252525;
}
.recovery-popup__copy {
  max-width: 320px;
  margin: 8px auto 0;
  font-size: 13px;
  line-height: 1.65;
  color: #666;
}
.recovery-popup__actions {
  display: flex;
  padding-top: 20px;
  gap: 10px;
}
.backfill-popup {
  padding-bottom: calc(14px + env(safe-area-inset-bottom));
  background: #fff;
}
.backfill-popup__body {
  padding: 6px 16px 0;
}
.backfill-field {
  padding-top: 14px;
}
.backfill-field__label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: #555;
}
.backfill-popup .recovery-popup__actions {
  padding: 16px 16px 0;
}
.photo-field {
  padding-top: 14px;
  margin-top: 12px;
}
.role-note {
  padding: 10px 12px;
  margin: 10px 0 2px;
  font-size: 12px;
  line-height: 1.5;
  color: #6d5731;
  background: #fff8e8;
  border: 1px solid #f0dfb5;
  border-radius: 9px;
}
.photos,
.chips {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
}
.choice-group {
  display: flex;
  padding: 3px;
  background: #f1f4f7;
  border-radius: 10px;
  gap: 4px;
}
.choice-group text {
  min-width: 52px;
  padding: 7px 16px;
  font-size: 13px;
  color: #566579;
  text-align: center;
  border-radius: 8px;
}
.choice-group text.on {
  font-weight: 600;
  color: #176ac7;
  background: #fff;
  box-shadow: 0 3px 9px rgb(30 74 120 / 10%);
}
.choice-group.disabled,
.chips.disabled {
  opacity: 0.58;
}
.choice-group.disabled text,
.chips.disabled .chip {
  cursor: not-allowed;
}
.inline-empty {
  padding: 7px 0;
  font-size: 12px;
  line-height: 1.5;
  color: #767676;
}
.inline-empty--error {
  color: #a13a3a;
}
.outsourcing-list {
  padding: 4px 0 12px;
}
.outsourcing-row {
  padding: 0 12px 10px;
  margin-bottom: 10px;
  background: #f7f9fb;
  border-radius: 12px;
}
.outsourcing-fields {
  display: flex;
  align-items: center;
  gap: 10px;
}
.outsourcing-fields > view {
  display: flex;
  min-width: 0;
  font-size: 12px;
  color: #566579;
  align-items: center;
  flex: 1;
  gap: 5px;
}
.outsourcing-fields input {
  min-width: 0;
  padding: 7px 8px;
  font-size: 14px;
  color: #222;
  text-align: center;
  background: #fff;
  border: 1px solid #d8dee6;
  border-radius: 8px;
  flex: 1;
}
.outsourcing-fields input[disabled] {
  color: #6d7785;
  background: #eef1f4;
}
.outsourcing-remove {
  min-height: 36px;
  padding: 0 2px 0 8px;
  font-size: 12px;
  line-height: 36px;
  color: #a13a3a;
  flex: none;
}
.outsourcing-plan {
  margin-top: 7px;
  font-size: 11px;
  color: #68788a;
}
.photo {
  position: relative;
  display: flex;
  width: 64px;
  height: 64px;
  margin: 0 8px 8px 0;
  overflow: hidden;
  font-size: 13px;
  color: #555;
  border-radius: 8px;
  align-items: center;
  justify-content: center;
}
.photo image {
  width: 100%;
  height: 100%;
}
.photo > text {
  position: absolute;
  top: 0;
  right: 0;
  width: 22px;
  height: 22px;
  font-size: 16px;
  line-height: 22px;
  color: #fff;
  text-align: center;
  background: rgb(0 0 0 / 58%);
}
.add-photo {
  border: 1px dashed #aaa;
}
.chip {
  padding: 6px 13px;
  margin: 0 8px 8px 0;
  font-size: 13px;
  color: #555;
  border: 1px solid #ccc;
  border-radius: 16px;
}
.chip.on {
  color: #176ac7;
  background: #eaf4ff;
  border-color: #79afea;
}
.material-row {
  display: flex;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  align-items: center;
}
.material-copy {
  font-size: 14px;
  color: #222;
  flex: 1;
}
.material-copy text {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  color: #666;
}
.quantity {
  display: flex;
  margin-left: 12px;
  font-size: 12px;
  color: #666;
  align-items: center;
}
.quantity input {
  width: 48px;
  padding: 5px 6px;
  margin-right: 5px;
  font-size: 14px;
  text-align: center;
  border: 1px solid #ccc;
  border-radius: 6px;
}
.material-remove {
  padding: 7px 0 7px 10px;
  margin-left: 4px;
  font-size: 12px;
  color: #a13a3a;
}
.material-empty {
  padding: 8px 0 12px;
  font-size: 13px;
  color: #666;
  text-align: center;
}
.material-select {
  padding: 10px 12px;
  margin-top: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #176ac7;
  text-align: center;
  background: #edf5ff;
  border-radius: 8px;
}
.material-select.disabled {
  color: #777;
  background: #f1f1f1;
}
.material-error {
  padding: 10px 0 2px;
  font-size: 12px;
  color: #a13a3a;
  text-align: center;
}
.material-popup {
  box-sizing: border-box;
  height: 62vh;
  padding-bottom: env(safe-area-inset-bottom);
  background: #fff;
}
.project-popup {
  box-sizing: border-box;
  height: 64vh;
  padding-bottom: env(safe-area-inset-bottom);
  background: #fff;
}
.project-popup__header {
  display: flex;
  padding: 18px 16px 14px;
  border-bottom: 1px solid #ededed;
  align-items: flex-start;
  justify-content: space-between;
}
.project-popup__title {
  font-size: 16px;
  font-weight: 650;
  color: #222;
}
.project-popup__hint {
  margin-top: 4px;
  font-size: 12px;
  color: #666;
}
.project-popup__close {
  min-width: 52px;
  padding: 2px 0 8px 14px;
  font-size: 13px;
  color: #176ac7;
  text-align: right;
}
.project-popup__list {
  box-sizing: border-box;
  height: calc(64vh - 142px);
  padding: 4px 16px 16px;
}
.project-option {
  display: flex;
  min-height: 58px;
  padding: 11px 12px;
  margin-top: 8px;
  background: #f7f9fb;
  border: 1px solid #edf0f3;
  border-radius: 12px;
  align-items: center;
}
.project-option.on {
  background: #edf5ff;
  border-color: #a8cff9;
}
.project-option__body {
  display: flex;
  gap: 16px;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  flex: 1;
}
.project-option__name {
  min-width: 0;
  overflow: hidden;
  font-size: 14.5px;
  font-weight: 650;
  line-height: 1.45;
  color: #1f2937;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.project-option__period {
  max-width: 44%;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.45;
  color: #667085;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: none;
}
.project-option.on .project-option__name {
  color: #176ac7;
}
.project-option.on .project-option__period {
  color: #356d9f;
}
.project-option__check {
  display: flex;
  width: 18px;
  height: 18px;
  margin-left: 8px;
  align-items: center;
  justify-content: center;
  flex: none;
}
.material-popup__header {
  display: flex;
  padding: 18px 16px 14px;
  border-bottom: 1px solid #ededed;
  align-items: flex-start;
  justify-content: space-between;
}
.material-popup__title {
  font-size: 16px;
  font-weight: 650;
  color: #222;
}
.material-popup__hint {
  margin-top: 4px;
  font-size: 12px;
  color: #666;
}
.material-popup__close {
  padding: 2px 0 8px 14px;
  font-size: 13px;
  color: #176ac7;
}
.material-search {
  display: flex;
  padding: 9px 12px;
  margin: 12px 16px 0;
  background: #f4f6f8;
  border: 1px solid #e1e4e8;
  border-radius: 10px;
  align-items: center;
}
.material-search__input {
  min-width: 0;
  font-size: 14px;
  color: #222;
  flex: 1;
}
.material-search__clear {
  padding-left: 12px;
  font-size: 12px;
  color: #176ac7;
}
.material-popup__list {
  box-sizing: border-box;
  height: calc(62vh - 238px);
  padding: 0 16px;
}
.material-popup__toolbar {
  display: flex;
  min-height: 40px;
  padding: 0 16px;
  font-size: 12px;
  color: #68788a;
  align-items: center;
  justify-content: space-between;
}
.material-popup__select-all {
  display: flex;
  min-width: 56px;
  min-height: 40px;
  font-weight: 600;
  color: #176ac7;
  align-items: center;
  justify-content: flex-end;
}
.material-popup__select-all.disabled {
  color: #9aa3ad;
}
.material-option {
  display: flex;
  min-height: 64px;
  padding: 12px 0;
  border-bottom: 1px solid #ededed;
  align-items: center;
}
.material-option.on .material-copy > view {
  color: #176ac7;
  font-weight: 600;
}
.material-check {
  display: flex;
  width: 22px;
  height: 22px;
  margin-left: 12px;
  font-size: 13px;
  color: #fff;
  background: #fff;
  border: 1px solid #aaa;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  flex: none;
}
.material-option.on .material-check {
  background: #2f86ff;
  border-color: #2f86ff;
}
.material-popup__empty {
  padding: 56px 16px;
  font-size: 13px;
  color: #666;
  text-align: center;
}
.material-popup__footer {
  padding: 12px 16px;
  border-top: 1px solid #ededed;
}
.material-popup__footer .btn {
  display: block;
  padding: 12px;
  text-align: center;
}
.summary > view {
  display: flex;
  padding: 7px 0;
}
.summary > view text:first-child {
  width: 76px;
  font-size: 13px;
  color: #666;
}
.summary > view text:last-child {
  font-size: 13px;
  line-height: 1.5;
  color: #222;
  flex: 1;
}
.warning {
  margin-bottom: 12px;
  font-size: 13px;
  line-height: 1.6;
  color: #8d3131;
}
.reason {
  box-sizing: border-box;
  width: 100%;
  height: 92px;
  padding: 10px;
  font-size: 14px;
  border: 1px solid #d6a4a4;
  border-radius: 8px;
}
.complete-card {
  padding: 28px 20px 20px;
  margin: 16px 12px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 8px 22px rgb(25 68 110 / 9%);
}
.complete-icon {
  display: flex;
  width: 54px;
  height: 54px;
  margin: 0 auto;
  font-size: 28px;
  color: #fff;
  background: #35a66f;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
}
.complete-title {
  margin-top: 14px;
  font-size: 19px;
  font-weight: 700;
  color: #1f2d3d;
  text-align: center;
}
.complete-no {
  margin-top: 5px;
  font-size: 13px;
  color: #176ac7;
  text-align: center;
}
.complete-list {
  padding-top: 14px;
  margin-top: 18px;
  border-top: 1px solid #ededed;
}
.complete-list > view {
  display: flex;
  padding: 7px 0;
  font-size: 13px;
}
.complete-list > view text:first-child {
  width: 84px;
  color: #666;
}
.complete-list > view text:last-child {
  color: #222;
  text-align: right;
  flex: 1;
}
.complete-list .danger {
  color: #b84141;
}
.complete-actions,
.bottom {
  display: flex;
  gap: 10px;
  padding: 11px 14px calc(11px + env(safe-area-inset-bottom));
}
.complete-actions {
  padding: 0 12px 32px;
}
.bottom {
  background: #fff;
  border-top: 1px solid #e8e8e8;
}
.btn,
.complete-actions text {
  padding: 11px 8px;
  font-size: 14px;
  text-align: center;
  border-radius: 22px;
  flex: 1;
}
.plain {
  color: #555;
  border: 1px solid #ccc;
}
.primary {
  color: #fff;
  background: #2f86ff;
}
.disabled {
  opacity: 0.55;
}
.empty {
  padding: 32px 16px;
  font-size: 14px;
  color: #666;
  text-align: center;
}
</style>
