"""
Franmit Reactor Model - Standalone Python Script
Ejecutable localmente sin Lambda. Recibe JSON por stdin y devuelve resultados por stdout.

Uso:
    echo '{"receta": {...}, "reactor_config": {...}}' | python franmit_model.py
"""

import json
import sys
import math
import traceback
from random import randrange
import numpy as np

# ============================================================================
# SETTINGS
# ============================================================================

T_dep_properties = {
    "rho_p": 946,
    "rho_hx": 655,
    "Henry_et": 79.6374292,
    "Henry_H": 1033.928315,
    "Henry_but": 79.6374292,
    "Rgas": 0.0831446,
    "pvap_hx": 1.77,
}

comp_all = {
    "Et": {"Tc": 282.359, "Wi": 0.085, "Pc": 50.317, "MW": 28.053},
    "But": {"Tc": 417.89, "Wi": 0.18998, "Pc": 40.023, "MW": 56.10},
    "H2": {"Tc": 33.44, "Wi": -0.12, "Pc": 13.15, "MW": 2.},
    "Hx": {"Tc": 507, "Wi": 0.3, "Pc": 30., "MW": 86.0},
    "N2": {"Tc": 126.1940, "Wi": 0.0399, "Pc": 33.94, "MW": 28.0},
    "CH4": {"Tc": 190.7, "Wi": 0.0115, "Pc": 46.4, "MW": 16.0},
}

kinetic_params_8sites_BCJ_v1 = {
    "Kps": [337.043673, 100.024873, 1337.429231, 374.714439, 537.58892, 2723.269918, 479.440004, 2147.611526],
    "Khs": [21.013979, 101.110131, 217.473902, 21.658711, 10.512836, 336.353826, 315.589945, 269.978249],
    "Kis": [2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000],
    "Ka": 10000,
    "Kd": 0,
    "fs": [0.327601, 0.018052, 0.144428, 0.15141, 0.208067, 0.000935, 0.149508, 0],
    "Kh_H_negativo": 4.930868484533288,
    "Kh_H_negativo_exp": 0.5301838798182428,
    "Kp_H_negativo": 0.14988101427630118,
    "Kcat_desactivacion_H": 0.16,
    "Kcat_desactivacion_H_exp": 1.2,
    "Kpbut_Kp_ratio": 0.37,
    "pasta_offset": 2.9,
    "hold_up": 0,
    "f1_rns": 1.017447,
    "f2_rns": 1.297858,
    "miS_scale": 3.5,
    "mf1": 0.78545,
    "pureza_LM": 1.0,
}

kinetic_params_8sites_PZ_v2 = {
    "Kps": [2734.12115, 9896.703671, 892.297878, 3574.058703, 5472.798997, 983.896948, 2558.336481, 133.708877],
    "Khs": [115.02047, 532.817374, 489.356089, 240.260998, 91.717743, 104.470002, 489.433456, 744.410718],
    "Kis": [2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000],
    "Ka": 10000,
    "Kd": 0,
    "fs": [0.089809, 0.031258, 0.189024, 0.041485, 0.056881, 0.211431, 0.181908, 0.198203],
    "Kh_H_negativo": 6.925049059265804,
    "Kh_H_negativo_exp": 0.460021084724186,
    "Kp_H_negativo": 0.09960654299361706,
    "Kcat_desactivacion_H": 0.16,
    "Kcat_desactivacion_H_exp": 1.2,
    "Kpbut_Kp_ratio": 0.37,
    "pasta_offset": 2.9,
    "hold_up": 0,
    "f1_rns": 0.8000024097968286,
    "f2_rns": 1.4999999511495679,
    "miS_scale": 1.5161444423888912,
    "mf1": 0.8752613470525453,
    "pureza_LM": 1.0,
}

KINETIC_PARAM_REGISTRY = {
    "8sites_BCJ_v1": kinetic_params_8sites_BCJ_v1,
    "8sites_PZ_v2": kinetic_params_8sites_PZ_v2,
}

_grados_dict = {
    "5803": ("S", "PZ"), "R4805": ("P", "PZ"), "R4806HT": ("P", "BCJ50"),
    "T100NLS": ("S", "BCJ50"), "5605N": ("S", "PZ"), "M5309": ("P", "PZ"),
    "M5206": ("P", "BCJ50"), "TR156G": ("S", "PZ"), "T80N": ("S", "PZ"),
    "M5204": ("P", "BCJ50"), "6006LS": ("S", "PZ"), "4910": ("S", "PZ")
}

settings = {
    "default_sites": {"PZ": 8, "BCJ": 8, "BCJ50": 8},
    "kinetic_parameters": KINETIC_PARAM_REGISTRY,
    "T_dep_properties": T_dep_properties,
    "components": comp_all,
    "grados_dict": _grados_dict,
    "catalizer": ["PZ", "BCJ50", "BCJ"],
}

stts = settings

# ============================================================================
# RK4 ODE SOLVER
# ============================================================================

def odeint_rk4(func, y0, t, args=()):
    """Runge-Kutta 4th order ODE solver"""
    y0 = np.asarray(y0, dtype=float)
    n = len(t)
    y = np.zeros((n, len(y0)))
    y[0] = y0
    
    for i in range(n - 1):
        dt = t[i + 1] - t[i]
        yi = y[i]
        ti = t[i]
        
        k1 = np.asarray(func(yi, ti, *args), dtype=float)
        k2 = np.asarray(func(yi + 0.5 * dt * k1, ti + 0.5 * dt, *args), dtype=float)
        k3 = np.asarray(func(yi + 0.5 * dt * k2, ti + 0.5 * dt, *args), dtype=float)
        k4 = np.asarray(func(yi + dt * k3, ti + dt, *args), dtype=float)
        
        y[i + 1] = yi + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)
    
    return y

# ============================================================================
# SOLVER FUNCTIONS (copiadas del archivo original)
# ============================================================================

def load_params(name):
    reg = stts['kinetic_parameters']
    if name in reg:
        return reg[name]
    raise ValueError(f"Parameters {name} not found")

def rho_pBCJ(Mi, ratio_but_et):
    return 0.959862 + 0.002675 * np.log(Mi) - 0.0248748 * ratio_but_et ** 0.3811

def rho_pPZ(Mi, ratio_but_et):
    return 0.9602 + 0.0029 * np.log(Mi) - 0.02171179 * ratio_but_et ** 0.4275

def flory_distribution_rns_xmjs(rns, xmjs):
    tau = 1 / rns
    _exp = np.linspace(0, 6, 200)
    r = 10 ** (_exp)
    dists = np.array([xmj * ((r * _tau) ** 2 * np.exp(-_tau * r)) for _tau, xmj in zip(tau, xmjs)])
    dist = np.sum(dists, axis=0)
    dist = dist / np.sum(dist)
    return np.log10(stts["components"]["Et"]["MW"] * r), dist

def mi_bcj(Mw):
    return 4.09 * 1e17 * np.power(Mw, -3.4349)

def mi_bcj5(Mw):
    return mi_bcj(Mw) * 3.022

def mi_pz5(Mw):
    return mi_pz(Mw) * 3

def mi_pz(Mw):
    return 2.76 * 1e18 * np.power(Mw, -3.5576)

def _calc_pressure_and_slurry_reactives(receta, H, M, B, Hx):
    T_dep = stts["T_dep_properties"]
    Temp = receta['T']
    Ph = H * (T_dep["Rgas"] * Temp)
    Pet = M * (T_dep["Rgas"] * Temp)
    Pbut = B * (T_dep["Rgas"] * Temp)
    Hs = Hx * (Ph / T_dep["Henry_H"])
    Ms = Hx * (Pet / T_dep["Henry_et"])
    Bs = Hx * (Pbut / T_dep["Henry_but"])
    return Hs, Ms, Bs, Ph, Pet, Pbut

def calculate_qv(reactor_config, receta, scale_cat, H, M, B, Kp, Yo, T1, To, hold_up_gas, qv_Hx_R1=0):
    T_dep = stts["T_dep_properties"]
    pureza_LM = receta.get('pureza_LM', 1.0)
    Mw_hx = stts["components"]["Hx"]["MW"]
    Mw_m = stts["components"]["Et"]["MW"]
    rho_hx = T_dep["rho_hx"]
    rho_p = T_dep["rho_p"]
    V_reb = reactor_config["V_reb"]
    Vm1 = Mw_hx / rho_hx
    Vm2 = Mw_m / rho_p
    Mw_p = Mw_m * T1 / To
    Hx = (1 - To * Mw_p / rho_p - hold_up_gas) * rho_hx / Mw_hx
    Hxs = Hx
    Hs, Ms, Bs, Ph, Pet, Pbut = _calc_pressure_and_slurry_reactives(receta, H, M, B, Hx)
    V_efective = V_reb * (1 - hold_up_gas)
    Q_hx = receta["Q_hx"] / V_efective
    Q_hx = pureza_LM * Q_hx + qv_Hx_R1
    qv = (Vm2 * Kp * Yo * Ms + Vm1 * Q_hx) / (Vm2 * T1 + Vm1 * Hxs)
    return qv

def _extra_calculation(reactor_config, params, scale_cat, Kp, Yo, M, B, receta, H, T1, To, _, Q_H2, qins_pol):
    T_dep = stts["T_dep_properties"]
    Mw_hx = stts["components"]["Hx"]["MW"]
    Mw_m = stts["components"]["Et"]["MW"]
    rho_hx = T_dep["rho_hx"]
    rho_p = T_dep["rho_p"]
    Temp = receta['T']
    V_reb = reactor_config["V_reb"]
    Q_H2 = receta["Q_H2"]
    Q_H2o = qins_pol.get("Q_H2o", 0) if qins_pol else 0
    Q_H2 = Q_H2 + Q_H2o
    Phx = T_dep["pvap_hx"]
    hold_up_gas = params['hold_up']
    V_efective = V_reb * (1 - hold_up_gas)
    
    Q_cat = scale_cat * receta["Q_cat"] / V_efective
    Q_H2_v = (receta["Q_H2"] + Q_H2o) / V_efective
    Q_et = receta["Q_et"] / V_efective
    Q_but = receta["Q_but"] / V_efective
    Q_Hx = receta["Q_hx"] / V_efective
    Q_cocat = receta["Q_cocat"] / V_efective
    
    Mw_p = Mw_m * T1 / To
    Hx = (1 - To * Mw_p / rho_p - hold_up_gas) * rho_hx / Mw_hx
    Hxs = Hx
    Hs, Ms, Bs, Ph, Pet, Pbut = _calc_pressure_and_slurry_reactives(receta, H, M, B, Hxs)
    P = Pbut + Ph + Pet + Phx
    q_out_hold_up = hold_up_gas * P / (T_dep["Rgas"] * Temp)
    
    qv_Hx_R1 = qins_pol.get("Q_Hxo", 0.) if qins_pol else 0.
    qv = calculate_qv(reactor_config, receta, scale_cat, H, M, B, Kp, Yo, T1, To, hold_up_gas, qv_Hx_R1=qv_Hx_R1)
    
    qvo_hx = qv * Hxs
    ratio_h2_et = H / (M + 1e-12)
    ratio_but_et = B / (M + 1e-12)
    V_p = T1 * V_efective * Mw_m / rho_p
    V_hx = V_efective - V_p
    p_out = qv * To * V_efective
    produccion = p_out * Mw_p * 3600 * 1e-3
    conversion_H = 1 - ((qv * Hs + q_out_hold_up) / Q_H2_v)
    pasta = V_efective * T1 * Mw_m / V_hx
    qvo_H2 = q_out_hold_up * V_efective
    
    return dict(
        P=P, qvo_Hx=qvo_hx, qvo_H2=qvo_H2, qv_Hx_R1=qv_Hx_R1, Pet=Pet, Ph=Ph,
        hold_up_gas=hold_up_gas, V_efective=V_efective, Q_cat=Q_cat, Q_H2=Q_H2_v,
        Q_et=Q_et, Q_hx=Q_Hx, Q_but=Q_but, Q_cocat=Q_cocat, Mw_p=Mw_p, Hx=Hx,
        q_out_hold_up=q_out_hold_up, Hs=Hs, Ms=Ms, Bs=Bs, Hxs=Hxs, qv=qv,
        ratio_h2_et=ratio_h2_et, ratio_but_et=ratio_but_et, V_p=V_p, V_hx=V_hx,
        produccion=produccion, conversion_H=conversion_H, pasta=pasta,
    )

def system_multiple_sites(u, t, p, return_qouts_pol=False):
    params, receta, qins, reactor_config = p
    r = receta
    scale_cat = reactor_config["scale_cat"]
    
    Khs = np.asarray(params["Khs"], dtype=float).ravel()
    Kps = np.asarray(params["Kps"], dtype=float).ravel()
    Kis = np.asarray(params["Kis"], dtype=float).ravel()
    fs = np.array(params["fs"]) / np.sum(params["fs"])
    
    Khs = Khs / (1 + params["Kh_H_negativo"] * receta["ratio_h2_et"] ** params["Kh_H_negativo_exp"])
    Kps = Kps / (1 + params["Kp_H_negativo"] * receta["ratio_h2_et"])
    Kcat_desactivacion_H = params["Kcat_desactivacion_H"]
    Kcat_desactivacion_H_exp = params["Kcat_desactivacion_H_exp"]
    
    VR = reactor_config["V_reb"]
    Ka = params["Ka"]
    Kd = params["Kd"]
    Q_H2 = receta["Q_H2"]
    nsites = len(params["Kps"])
    
    Pos = u[0:nsites]
    Yos = u[nsites:2*nsites]
    Y1s = u[2*nsites:3*nsites]
    Tos = u[3*nsites:4*nsites]
    T1s = u[4*nsites:5*nsites]
    T2s = u[5*nsites:6*nsites]
    C, M, B, H = u[6*nsites:]
    H = receta["ratio_h2_et"] * M
    
    PoT = np.sum(Pos)
    YoT = np.sum(Yos)
    ToT = np.sum(Tos)
    T1T = np.sum(T1s)
    
    fpo = Pos / PoT
    fyo = Yos / YoT
    KiT = np.sum(Kis * fpo)
    KpT = np.sum(Kps * fyo)
    KhT = np.sum(Khs * fyo)
    Kpbut = params["Kpbut_Kp_ratio"] * KpT
    Kibut = params["Kpbut_Kp_ratio"] * KiT
    
    vals = _extra_calculation(reactor_config, params, scale_cat, KpT, YoT, M, B, receta, H, T1T, ToT, None, Q_H2, qins)
    Ms, Hs, Bs, qv, q_out_hold_up = vals["Ms"], vals["Hs"], vals["Bs"], vals["qv"], vals["q_out_hold_up"]
    Q_et, Q_H2, Q_but = vals["Q_et"], vals["Q_H2"], vals["Q_but"]
    Q_cat = (1/VR) * r["Q_cat"] * scale_cat / (1 + Kcat_desactivacion_H * r["ratio_h2_et"] ** Kcat_desactivacion_H_exp)
    Q_cocat = vals["Q_cocat"]
    
    cocat = Q_cocat / qv
    Ka = cocat * Ka
    
    dC = -Ka * C + Q_cat - qv * C
    dPos, dYos, dY1s, dTos, dT1s, dT2s = [], [], [], [], [], []
    qo_Po, qo_Yo, qo_Y1, qo_To, qo_T1, qo_T2 = [], [], [], [], [], []
    
    for site in range(nsites):
        fsite = fs[site]
        Kp, Kh, Ki = Kps[site], Khs[site], Kis[site]
        Po, Yo, Y1 = Pos[site], Yos[site], Y1s[site]
        To, T1, T2 = Tos[site], T1s[site], T2s[site]
        Q_Po = qins["Q_Po"][site] if qins else 0
        Q_Yo = qins["Q_Yo"][site] if qins else 0
        Q_Y1 = qins["Q_Y1"][site] if qins else 0
        Q_To = qins["Q_To"][site] if qins else 0
        Q_T1 = qins["Q_T1"][site] if qins else 0
        Q_T2 = qins["Q_T2"][site] if qins else 0
        
        dPo = Ka * fsite * C - Ki * Po * Ms - Kd * Po + Kh * Yo * Hs - qv * Po + Q_Po
        dYo = Ki * Po * Ms - Kh * Yo * Hs - qv * Yo - Kd * Yo + Q_Yo
        dY1 = Ki * Po * Ms + Kp * Ms * Yo - qv * Y1 - Kd * Y1 - Kh * Hs * Y1 + Q_Y1
        dTo = Ki * Po * Ms - qv * To + Q_To
        dT1 = Ki * Po * Ms + Kp * Yo * Ms - qv * T1 + Q_T1
        dT2 = Ki * Po * Ms + Kp * Ms * Yo + 2 * Kp * Ms * Y1 - qv * T2 + Q_T2
        
        dPos.append(dPo)
        dYos.append(dYo)
        dY1s.append(dY1)
        dTos.append(dTo)
        dT1s.append(dT1)
        dT2s.append(dT2)
        qo_Po.append(qv * Po)
        qo_Yo.append(qv * Yo)
        qo_Y1.append(qv * Y1)
        qo_To.append(qv * To)
        qo_T1.append(qv * T1)
        qo_T2.append(qv * T2)
    
    dM = -(KiT * PoT + KpT * YoT) * Ms + Q_et - qv * Ms
    dB = -(Kibut * PoT + Kpbut * YoT) * Bs + Q_but - qv * Bs
    dH = -KhT * Hs * YoT + Q_H2 - qv * Hs - q_out_hold_up
    
    out = np.concatenate((dPos, dYos, dY1s, dTos, dT1s, dT2s, [dC, dM, dB, dH]))
    
    if not return_qouts_pol:
        return out
    else:
        qout = dict(Q_H2o=vals["qvo_H2"], Q_Hxo=vals["qvo_Hx"], Q_Po=qo_Po, Q_Yo=qo_Yo, Q_Y1=qo_Y1, Q_To=qo_To, Q_T1=qo_T1, Q_T2=qo_T2)
        return out, qout

def process_output_multiple_sites(u, catalizer, receta, qins, params, reactor_config):
    r = receta
    if len(np.shape(u)) == 1:
        u = u.reshape((1, -1))
    
    nsites = int((np.shape(u)[-1] - 4) / 6)
    T_dep = stts["T_dep_properties"]
    scale_cat = reactor_config["scale_cat"]
    
    Khs = np.asarray(params["Khs"], dtype=float).ravel()
    Kps = np.asarray(params["Kps"], dtype=float).ravel()
    Kis = np.asarray(params["Kis"], dtype=float).ravel()
    fs = np.array(params["fs"]) / np.sum(params["fs"])
    Khs = Khs / (1 + params["Kh_H_negativo"] * receta["ratio_h2_et"] ** params["Kh_H_negativo_exp"])
    Kps = Kps / (1 + params["Kp_H_negativo"] * receta["ratio_h2_et"])
    
    Kcat_desactivacion_H = params["Kcat_desactivacion_H"]
    Kcat_desactivacion_H_exp = params["Kcat_desactivacion_H_exp"]
    VR = reactor_config["V_reb"]
    
    Pos = u[:, 0:nsites]
    Yos = u[:, nsites:2*nsites]
    Y1s = u[:, 2*nsites:3*nsites]
    Tos = u[:, 3*nsites:4*nsites]
    T1s = u[:, 4*nsites:5*nsites]
    T2s = u[:, 5*nsites:6*nsites]
    C, M, B, H = u[:, 6*nsites], u[:, 6*nsites+1], u[:, 6*nsites+2], u[:, 6*nsites+3]
    
    PoT = np.sum(Pos, axis=1)
    YoT = np.sum(Yos, axis=1)
    ToT = np.sum(Tos, axis=1)
    T1T = np.sum(T1s, axis=1)
    T2T = np.sum(T2s, axis=1)
    Y1T = np.sum(Y1s, axis=1)
    
    fpo = Pos / PoT.reshape(-1, 1)
    fyo = Yos / YoT.reshape(-1, 1)
    KiT = np.sum(np.array(Kis).reshape(1, nsites) * fpo, axis=1)
    KpT = np.sum(np.array(Kps).reshape(1, nsites) * fyo, axis=1)
    KhT = np.sum(np.array(Khs).reshape(1, nsites) * fyo, axis=1)
    
    Kpbut = params["Kpbut_Kp_ratio"] * KpT
    Q_H2 = receta["Q_H2"]
    H = receta["ratio_h2_et"] * M
    
    vals = _extra_calculation(reactor_config, params, scale_cat, KpT, YoT, M, B, receta, H, T1T, ToT, None, Q_H2, qins)
    
    Ms, Hs, Bs, qv = vals["Ms"], vals["Hs"], vals["Bs"], vals["qv"]
    V_efective, Mw_p, P = vals["V_efective"], vals["Mw_p"], vals["P"]
    produccion, conversion_H, pasta = vals["produccion"], vals["conversion_H"], vals["pasta"]
    
    Mw_m = stts["components"]["Et"]["MW"]
    rmp = (stts["components"]["Hx"]["MW"] * receta["Q_hx"] * T_dep["rho_p"]) / (Mw_m * receta["Q_et"] * T_dep["rho_hx"])
    pastaf = T_dep["rho_p"] / rmp + params["pasta_offset"]
    pasta = pasta + (pastaf - pasta[-1])
    
    Mn = Mw_p
    Mw = Mw_m * T2T / T1T
    PDI = Mw / Mn
    Bs = r["Q_but"] * (1/VR) * (1 / (Kpbut * YoT + qv))
    ratio_but_et = (T_dep["Henry_but"] / T_dep["Henry_et"]) * (Bs / Ms)
    rns = 0.5 * (T2s / T1s)
    xmj = T1s / T1T.reshape(-1, 1)
    wr, flory_final = flory_distribution_rns_xmjs(rns[0], xmj[0])
    flory_final = flory_final / np.max(flory_final)
    
    if catalizer == "PZ":
        Mi = mi_pz(Mw)
        Mi5 = mi_pz5(Mw)
        rho_p_calc = rho_pPZ(Mi, ratio_but_et)
    else:
        Mi = mi_bcj(Mw)
        Mi5 = mi_bcj5(Mw)
        rho_p_calc = rho_pBCJ(Mi, ratio_but_et)
    
    xbut = ratio_but_et / (1 + r["ratio_h2_et"] + ratio_but_et)
    
    return {
        "xbut": xbut, "rho_p_calculated": rho_p_calc, "Mi5": Mi5, "xmj": xmj[0], "rns": rns[0],
        "Kis": Kis, "Kps": Kps, "Khs": Khs, "KiT": KiT, "fs": fs,
        "flory_distribution_y": flory_final, "flory_distribution_x": wr,
        "T1T": T1T, "ToT": ToT, "YoT": YoT, "KhT": KhT, "KpT": KpT,
        "Mn": Mn, "Mw": Mw, "Mi": Mi, "PDI": PDI, "P": P,
        "ratio_h2_et": vals["ratio_h2_et"], "ratio_but_et": ratio_but_et,
        "qv": qv, "t_resid": 1/qv, "produccion": produccion,
        "conversion_H": conversion_H, "pasta": pasta, "Hs": Hs, "Ms": Ms, "Bs": Bs,
        "Hxs": vals["Hxs"], "nsites": np.array([nsites]),
    }

class BaseSolver:
    def __init__(self):
        self._good_u0_8sites = np.ones(52) * 1e-5
    
    def load_params(self, nsites, catalizer, version="latest"):
        if catalizer == "BCJ50":
            catalizer = "BCJ"
        name = f"{nsites}sites_{catalizer}"
        versions = [int(_name.split("_")[-1][1:]) for _name in stts["kinetic_parameters"] if name in _name]
        latest = sorted(versions)[-1]
        name = name + f"_v{latest}"
        return load_params(name)

class SolverR(BaseSolver):
    def __init__(self):
        super().__init__()
    
    def _calculate_nvars(self, params):
        nsites = len(params["Kps"])
        return nsites * 6 + 4, nsites
    
    def solve(self, catalizer, qins, receta, reactor_config, hours=100, step=10, u0=None, params=None, give_only_last=True):
        if not params:
            params = self.load_params(8, catalizer)
        
        nvars, nsites = self._calculate_nvars(params)
        
        if u0 is None:
            u0 = np.ones(nvars) * 1e-5
        
        T = hours * 3600
        t = np.arange(0, T, step)
        args = ([params, receta, qins, reactor_config],)
        u = odeint_rk4(REACTOR_NODE, u0, t, args=args)
        
        results_dict = process_output_multiple_sites(u if not give_only_last else u[-1:], catalizer, receta, qins, params, reactor_config)
        results_dict["t"] = t
        results_dict["rns"] = results_dict["rns"] * params["f1_rns"]
        results_dict['qouts_pol'] = receta.get('qouts_pol', {})
        return u, results_dict

def REACTOR_NODE(u, t, p):
    params, receta, qins, reactor_config = p
    du, q_pol = system_multiple_sites(u, t, p, return_qouts_pol=True)
    receta['qouts_pol'] = q_pol
    return du

def solve_recetas_parallel(qins, dict_recetas, reactor_configuration, params=None, hours=40, step=100):
    outs = []
    qouts_list = []
    u_final = None
    
    for name, receta in dict_recetas.items():
        solver = SolverR()
        cat_raw = stts['grados_dict'].get(name, ("P", "BCJ50"))[1]
        catalizer = "BCJ" if cat_raw == "BCJ50" else cat_raw
        
        if not params:
            params = solver.load_params(stts["default_sites"][catalizer], catalizer)
        
        u, out_final = solver.solve(catalizer, qins, receta, reactor_configuration, params=params, hours=hours, step=step)
        qouts_list.append(out_final.get('qouts_pol', {}))
        if 'qouts_pol' in out_final:
            del out_final['qouts_pol']
        outs.append(out_final)
        u_final = u
    
    outs = dict(zip(dict_recetas.keys(), outs))
    return u_final, outs, qouts_list

# ============================================================================
# MAIN - Lee JSON de stdin y devuelve resultados por stdout
# ============================================================================

def to_list(obj):
    """Convierte numpy arrays a tipos nativos de Python"""
    if isinstance(obj, np.ndarray):
        result = obj.tolist()
        return to_list(result)
    elif isinstance(obj, dict):
        return {k: to_list(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [to_list(i) for i in obj]
    elif isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        val = float(obj)
        if math.isnan(val) or math.isinf(val):
            return None
        return val
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif hasattr(obj, 'item'):
        val = obj.item()
        if isinstance(val, float):
            if math.isnan(val) or math.isinf(val):
                return None
        return val
    return obj

if __name__ == "__main__":
    try:
        # Leer JSON de stdin
        input_data = json.load(sys.stdin)
        
        receta = input_data.get("receta", {})
        reactor_config = input_data.get("reactor_configuration", {"V_reb": 53, "scale_cat": 1})
        qins = input_data.get("qins", {
            'Q_H2o': 0, 'Q_Hxo': 0,
            'Q_Po': [0]*8, 'Q_Yo': [0]*8, 'Q_Y1': [0]*8,
            'Q_To': [0]*8, 'Q_T1': [0]*8, 'Q_T2': [0]*8,
        })
        
        # Convertir strings a float (los valores del frontend llegan como strings)
        def to_numeric(val):
            """Convierte un valor a float si es posible, o deja listas/dicts intactos."""
            if isinstance(val, str):
                try:
                    return float(val)
                except (ValueError, TypeError):
                    return val
            elif isinstance(val, list):
                return [to_numeric(v) for v in val]
            elif isinstance(val, dict):
                return {k: to_numeric(v) for k, v in val.items()}
            return val
        
        receta = to_numeric(receta)
        reactor_config = to_numeric(reactor_config)
        qins = to_numeric(qins)
        
        # Validar receta
        required_keys = ["Q_cat", "Q_cocat", "Q_but", "Q_et", "Q_H2", "Q_hx", "T", "ratio_h2_et"]
        for key in required_keys:
            if key not in receta:
                raise ValueError(f"'{key}' not present in receta input")
        
        grado = receta.get("grado", "M5206")
        recetas = {grado: receta}
        
        # Ejecutar modelo
        u, outs, qouts = solve_recetas_parallel(qins, recetas, reactor_config)
        
        # Convertir a tipos nativos
        result = {
            "success": True,
            "outs": to_list(outs),
            "qouts": to_list(qouts)
        }
        
        # Escribir JSON a stdout
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_result))
        sys.exit(1)


